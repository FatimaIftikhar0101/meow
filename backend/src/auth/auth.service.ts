import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { ChangePasswordDto } from './dto/change-password.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import type { GoogleProfile } from './google.strategy';

const BCRYPT_ROUNDS = 10;
const VERIFY_TOKEN_BYTES = 32;
const VERIFY_TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

// Map ISO country (or country name) to the user's home wallet currency.
// Defaults to CAD since our launch corridor is Canada -> Pakistan.
function homeCurrencyFor(country?: string): string {
  if (!country) return 'CAD';
  const c = country.trim().toLowerCase();
  if (c === 'ca' || c === 'canada') return 'CAD';
  if (c === 'us' || c === 'usa' || c === 'united states') return 'USD';
  if (c === 'gb' || c === 'uk' || c === 'united kingdom') return 'GBP';
  if (c === 'pk' || c === 'pakistan') return 'PKR';
  return 'CAD';
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly mail: MailService,
  ) {}

  async register(dto: RegisterDto) {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existing) {
      throw new ConflictException('Email already registered');
    }

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    const currency = homeCurrencyFor(dto.country);
    const role = this.isAdminEmail(dto.email) ? 'admin' : 'customer';
    const verifyToken = crypto.randomBytes(VERIFY_TOKEN_BYTES).toString('hex');

    const user = await this.prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          email: dto.email,
          passwordHash,
          country: dto.country?.trim() || null,
          role,
          emailVerifyToken: verifyToken,
          emailVerifyExpires: new Date(Date.now() + VERIFY_TOKEN_TTL_MS),
        },
      });
      await tx.wallet.create({
        data: { userId: created.id, currency },
      });
      await tx.auditLog.create({
        data: {
          userId: created.id,
          action: 'auth.register',
          entityType: 'user',
          entityId: created.id,
        },
      });
      return created;
    });

    this.mail.sendVerificationEmail(user.email, verifyToken).catch(() => {});

    return this.signToken(user.id, user.email, user.role);
  }

  async googleLogin(profile: GoogleProfile) {
    let user = await this.prisma.user.findUnique({
      where: { googleId: profile.googleId },
    });

    if (!user) {
      user = await this.prisma.user.findUnique({
        where: { email: profile.email },
      });

      if (user) {
        user = await this.prisma.user.update({
          where: { id: user.id },
          data: {
            googleId: profile.googleId,
            authProvider: user.authProvider === 'local' ? 'local+google' : user.authProvider,
            emailVerified: true,
            firstName: user.firstName || profile.firstName || null,
            avatarUrl: user.avatarUrl || profile.avatarUrl || null,
          },
        });
      } else {
        const role = this.isAdminEmail(profile.email) ? 'admin' : 'customer';
        user = await this.prisma.$transaction(async (tx) => {
          const created = await tx.user.create({
            data: {
              email: profile.email,
              authProvider: 'google',
              googleId: profile.googleId,
              emailVerified: true,
              firstName: profile.firstName || null,
              avatarUrl: profile.avatarUrl || null,
              role,
            },
          });
          await tx.wallet.create({
            data: { userId: created.id, currency: 'CAD' },
          });
          await tx.auditLog.create({
            data: {
              userId: created.id,
              action: 'auth.google_register',
              entityType: 'user',
              entityId: created.id,
            },
          });
          return created;
        });
      }
    }

    if (user.suspended) {
      throw new ForbiddenException('Account suspended');
    }

    await this.prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'auth.google_login',
        entityType: 'user',
        entityId: user.id,
      },
    });

    return this.signToken(user.id, user.email, user.role);
  }

  async login(dto: LoginDto, expectedRole?: UserRole) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }
    if (!user.passwordHash) {
      throw new UnauthorizedException('This account uses Google sign-in');
    }
    const ok = await bcrypt.compare(dto.password, user.passwordHash);
    if (!ok) {
      throw new UnauthorizedException('Invalid email or password');
    }
    if (user.suspended) {
      throw new ForbiddenException('Account suspended');
    }

    // Keep the role column in sync with ADMIN_EMAILS on every login so an
    // existing customer added to the env list gets promoted on next sign-in.
    const desiredRole: UserRole = this.isAdminEmail(user.email) ? 'admin' : user.role;
    if (desiredRole !== user.role) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { role: desiredRole },
      });
      user.role = desiredRole;
    }

    if (expectedRole && user.role !== expectedRole) {
      throw new ForbiddenException(
        expectedRole === 'admin' ? 'Not an admin account' : 'Use the admin portal',
      );
    }

    await this.prisma.auditLog.create({
      data: {
        userId: user.id,
        action: expectedRole === 'admin' ? 'auth.admin_login' : 'auth.login',
        entityType: 'user',
        entityId: user.id,
      },
    });
    return this.signToken(user.id, user.email, user.role);
  }

  async profile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        country: true,
        role: true,
        emailVerified: true,
        createdAt: true,
      },
    });
    if (!user) {
      throw new UnauthorizedException();
    }
    return {
      userId: user.id,
      email: user.email,
      country: user.country,
      role: user.role,
      emailVerified: user.emailVerified,
      createdAt: user.createdAt,
    };
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException();
    if (!user.passwordHash) {
      throw new BadRequestException('This account uses Google sign-in and has no password to change');
    }
    const ok = await bcrypt.compare(dto.currentPassword, user.passwordHash);
    if (!ok) throw new BadRequestException('Current password is incorrect');
    if (dto.currentPassword === dto.newPassword) {
      throw new BadRequestException('New password must differ from current');
    }
    const passwordHash = await bcrypt.hash(dto.newPassword, BCRYPT_ROUNDS);
    const updated = await this.prisma.$transaction(async (tx) => {
      const u = await tx.user.update({
        where: { id: userId },
        data: { passwordHash, passwordChangedAt: new Date() },
      });
      await tx.auditLog.create({
        data: {
          userId,
          action: 'auth.change_password',
          entityType: 'user',
          entityId: userId,
        },
      });
      return u;
    });
    // Issue a fresh token so the caller doesn't get logged out on its next
    // request (old tokens are invalidated by the passwordChangedAt check).
    return this.signToken(updated.id, updated.email, updated.role);
  }

  async verifyEmail(token: string) {
    const user = await this.prisma.user.findFirst({
      where: { emailVerifyToken: token },
    });
    if (!user) {
      throw new BadRequestException('Invalid or expired verification link');
    }
    if (user.emailVerified) {
      return { message: 'Email already verified' };
    }
    if (user.emailVerifyExpires && user.emailVerifyExpires < new Date()) {
      throw new BadRequestException('Verification link has expired — request a new one');
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: user.id },
        data: {
          emailVerified: true,
          emailVerifyToken: null,
          emailVerifyExpires: null,
        },
      });
      await tx.auditLog.create({
        data: {
          userId: user.id,
          action: 'auth.email_verified',
          entityType: 'user',
          entityId: user.id,
        },
      });
    });
    return { message: 'Email verified successfully' };
  }

  async resendVerification(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException();
    if (user.emailVerified) {
      return { message: 'Email already verified' };
    }
    const verifyToken = crypto.randomBytes(VERIFY_TOKEN_BYTES).toString('hex');
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        emailVerifyToken: verifyToken,
        emailVerifyExpires: new Date(Date.now() + VERIFY_TOKEN_TTL_MS),
      },
    });
    await this.mail.sendVerificationEmail(user.email, verifyToken);
    return { message: 'Verification email sent' };
  }

  private isAdminEmail(email: string): boolean {
    const list = (this.config.get<string>('ADMIN_EMAILS') ?? '')
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
    return list.includes(email.trim().toLowerCase());
  }

  private signToken(userId: string, email: string, role: UserRole) {
    const access_token = this.jwt.sign({ sub: userId, email, role });
    return { access_token };
  }
}
