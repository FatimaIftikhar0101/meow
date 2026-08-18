import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  UnauthorizedException,
  forwardRef,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { OAuth2Client } from 'google-auth-library';
import { PrismaService } from '../prisma/prisma.service';
import { isStaff } from './permissions';
import { writeAudit } from '../common/audit/audit';
import { MailService } from '../mail/mail.service';
import { ReferralsService } from '../referrals/referrals.service';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import type { GoogleProfile } from './google.strategy';

const BCRYPT_ROUNDS = 10;
const VERIFY_TOKEN_BYTES = 32;
const VERIFY_TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour
const DEFAULT_SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export interface RequestContext {
  ip?: string;
  userAgent?: string;
}

// Map ISO country (or country name) to the user's home wallet currency.
// Defaults to CAD since our launch corridor is Canada -> Pakistan.
/**
 * Split a free-text full name into a display first name and the remainder.
 *
 * Deliberately naive: first token is the given name, everything after it is
 * the rest. That is wrong for plenty of naming conventions, which is exactly
 * why the *stored* value people typed is never reconstructed from these two
 * fields — `fullName` is what the user wrote, and firstName/lastName exist
 * only so the UI can greet someone by their given name. A single-token name
 * ("Prince") yields a null lastName rather than duplicating the value.
 */
export function splitName(fullName: string): {
  firstName: string;
  lastName: string | null;
} {
  const parts = fullName.replace(/\s+/g, ' ').trim().split(' ');
  return {
    firstName: parts[0],
    lastName: parts.length > 1 ? parts.slice(1).join(' ') : null,
  };
}

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
  /**
   * Verifies Google ID tokens from the native mobile client. Built lazily so
   * the service still constructs when Google is not configured — the endpoint
   * is separately gated by GoogleEnabledGuard.
   */
  private googleVerifier?: OAuth2Client;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly mail: MailService,
    @Inject(forwardRef(() => ReferralsService))
    private readonly referrals: ReferralsService,
  ) {}

  async register(dto: RegisterDto, ctx?: RequestContext) {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existing) {
      throw new ConflictException('Email already registered');
    }

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    const { firstName, lastName } = splitName(dto.fullName);
    const currency = homeCurrencyFor(dto.country);
    const role = this.isAdminEmail(dto.email) ? 'admin' : 'customer';
    const verifyToken = crypto.randomBytes(VERIFY_TOKEN_BYTES).toString('hex');

    const user = await this.prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          email: dto.email,
          passwordHash,
          firstName,
          lastName,
          country: dto.country?.trim() || null,
          role,
          emailVerifyToken: verifyToken,
          emailVerifyExpires: new Date(Date.now() + VERIFY_TOKEN_TTL_MS),
        },
      });
      await tx.wallet.create({
        data: { userId: created.id, currency },
      });
      await writeAudit(tx, {
        actor: { id: created.id, email: created.email },
        action: 'auth.register',
        entityType: 'user',
        entityId: created.id,
        context: { ip: ctx?.ip, userAgent: ctx?.userAgent },
      });
      return created;
    });

    this.mail.sendVerificationEmail(user.email, verifyToken).catch(() => {});

    if (dto.referralCode) {
      this.referrals.attachReferral(user.id, dto.referralCode).catch(() => {});
    }

    const session = await this.createSession(user.id, ctx);
    return this.signToken(user.id, user.email, user.role, session.id);
  }

  /**
   * Sign in from the native Android client.
   *
   * The web flow is a redirect: Passport bounces the browser to Google and
   * back, and the callback hands a token to FRONTEND_ORIGIN. A native app has
   * no browser to redirect, so it uses the platform account picker and comes
   * back holding a Google ID token instead. This endpoint verifies that token
   * and then hands off to the very same `googleLogin` the web flow uses, so
   * account linking, wallet creation, the suspension check, the audit row and
   * session creation all behave identically across the two clients.
   *
   * The audience is the *web* client ID, not the Android one:
   * @react-native-google-signin is configured with `webClientId`, and the token
   * Play Services mints carries that as its `aud`. The Android OAuth client
   * still has to exist in Google Cloud Console — it is what Play Services
   * checks the app's package name and signing fingerprint against before it
   * will issue a token at all.
   */
  async googleNativeLogin(idToken: string, ctx?: RequestContext) {
    const audience = this.config.get<string>('GOOGLE_CLIENT_ID') ?? '';
    if (!audience) {
      throw new BadRequestException('Google sign-in is not configured');
    }
    this.googleVerifier ??= new OAuth2Client();

    let payload;
    try {
      const ticket = await this.googleVerifier.verifyIdToken({
        idToken,
        audience,
      });
      payload = ticket.getPayload();
    } catch {
      // Covers a bad signature, an expired token, and a mismatched audience.
      // Deliberately not distinguished: the client cannot act on the
      // difference, and saying which one failed helps only an attacker.
      throw new UnauthorizedException('Invalid Google token');
    }

    if (!payload?.sub || !payload.email) {
      throw new UnauthorizedException('Invalid Google token');
    }
    if (!payload.email_verified) {
      // Without this, anyone able to create an unverified Google account for
      // an address could take over the local account that owns it.
      throw new UnauthorizedException('Google account email is not verified');
    }

    const profile: GoogleProfile = {
      googleId: payload.sub,
      email: payload.email.trim().toLowerCase(),
      firstName: payload.given_name ?? '',
      avatarUrl: payload.picture,
    };
    return this.googleLogin(profile, ctx);
  }

  async googleLogin(profile: GoogleProfile, ctx?: RequestContext) {
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
          await writeAudit(tx, {
            actor: { id: created.id, email: created.email },
            action: 'auth.google_register',
            entityType: 'user',
            entityId: created.id,
            context: { ip: ctx?.ip, userAgent: ctx?.userAgent },
          });
          return created;
        });
      }
    }

    if (user.suspended) {
      throw new ForbiddenException('Account suspended');
    }

    await writeAudit(this.prisma, {
      actor: { id: user.id, email: user.email },
      action: 'auth.google_login',
      entityType: 'user',
      entityId: user.id,
      context: { ip: ctx?.ip, userAgent: ctx?.userAgent },
    });

    const session = await this.createSession(user.id, ctx);
    return this.signToken(user.id, user.email, user.role, session.id);
  }

  /**
   * @param audience which door the request came through — the customer app or
   *        the back office. Not a role: staff roles other than admin must reach
   *        the back office, and customers must not.
   */
  async login(
    dto: LoginDto,
    audience?: 'customer' | 'staff',
    ctx?: RequestContext,
  ) {
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

    // Which door was used, not which exact role. Staff roles other than admin
    // — support, operations, compliance — must reach the back office, and an
    // exact-match check against 'admin' would have locked every one of them out
    // while telling them they were "not an admin account".
    if (audience === 'staff' && !isStaff(user.role)) {
      throw new ForbiddenException('Not a staff account');
    }
    if (audience === 'customer' && isStaff(user.role)) {
      throw new ForbiddenException('Use the admin portal');
    }

    await writeAudit(this.prisma, {
      actor: { id: user.id, email: user.email },
      action: audience === 'staff' ? 'auth.staff_login' : 'auth.login',
      entityType: 'user',
      entityId: user.id,
      context: { ip: ctx?.ip, userAgent: ctx?.userAgent },
    });
    const session = await this.createSession(user.id, ctx);
    return this.signToken(user.id, user.email, user.role, session.id);
  }

  async profile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
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
      firstName: user.firstName,
      lastName: user.lastName,
      // Pre-joined so callers don't each reimplement the null handling. Null
      // (not the email) when no name is on file, so the UI can decide how to
      // fall back rather than rendering a half-name.
      fullName:
        [user.firstName, user.lastName].filter(Boolean).join(' ') || null,
      country: user.country,
      role: user.role,
      emailVerified: user.emailVerified,
      createdAt: user.createdAt,
    };
  }

  async changePassword(userId: string, dto: ChangePasswordDto, ctx?: RequestContext) {
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
      await tx.session.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      await writeAudit(tx, {
        actor: { id: userId, email: u.email },
        action: 'auth.change_password',
        entityType: 'user',
        entityId: userId,
        context: { ip: ctx?.ip, userAgent: ctx?.userAgent },
      });
      return u;
    });
    const session = await this.createSession(updated.id, ctx);
    return this.signToken(updated.id, updated.email, updated.role, session.id);
  }

  async forgotPassword(dto: ForgotPasswordDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    // Always return success to prevent email enumeration
    if (!user || !user.passwordHash) {
      return { message: 'If that email is registered, a reset link has been sent' };
    }
    const resetToken = crypto.randomBytes(VERIFY_TOKEN_BYTES).toString('hex');
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        pwResetToken: resetToken,
        pwResetExpires: new Date(Date.now() + RESET_TOKEN_TTL_MS),
      },
    });
    await writeAudit(this.prisma, {
      actor: { id: user.id, email: user.email },
      action: 'auth.forgot_password',
      entityType: 'user',
      entityId: user.id,
    });
    this.mail.sendPasswordResetEmail(user.email, resetToken).catch(() => {});
    return { message: 'If that email is registered, a reset link has been sent' };
  }

  async resetPassword(dto: ResetPasswordDto) {
    const user = await this.prisma.user.findFirst({
      where: { pwResetToken: dto.token },
    });
    if (!user) {
      throw new BadRequestException('Invalid or expired reset link');
    }
    if (user.pwResetExpires && user.pwResetExpires < new Date()) {
      throw new BadRequestException('Reset link has expired — request a new one');
    }
    const passwordHash = await bcrypt.hash(dto.newPassword, BCRYPT_ROUNDS);
    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: user.id },
        data: {
          passwordHash,
          passwordChangedAt: new Date(),
          pwResetToken: null,
          pwResetExpires: null,
        },
      });
      await tx.session.updateMany({
        where: { userId: user.id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      await writeAudit(tx, {
        actor: { id: user.id, email: user.email },
        action: 'auth.reset_password',
        entityType: 'user',
        entityId: user.id,
      });
    });
    return { message: 'Password reset successfully' };
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
      await writeAudit(tx, {
        actor: { id: user.id, email: user.email },
        action: 'auth.email_verified',
        entityType: 'user',
        entityId: user.id,
        before: { emailVerified: false },
        after: { emailVerified: true },
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

  async listSessions(userId: string, currentSid: string) {
    const sessions = await this.prisma.session.findMany({
      where: {
        userId,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { lastSeenAt: 'desc' },
    });
    return sessions.map((s) => ({
      id: s.id,
      current: s.id === currentSid,
      userAgent: s.userAgent,
      ipAddress: s.ipAddress,
      lastSeenAt: s.lastSeenAt,
      createdAt: s.createdAt,
    }));
  }

  async revokeSession(userId: string, sessionId: string) {
    const session = await this.prisma.session.findUnique({
      where: { id: sessionId },
    });
    if (!session || session.userId !== userId) {
      throw new BadRequestException('Session not found');
    }
    if (session.revokedAt) {
      return { message: 'Session already revoked' };
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.session.update({
        where: { id: sessionId },
        data: { revokedAt: new Date() },
      });
      await writeAudit(tx, {
        actor: { id: userId },
        action: 'auth.session_revoke',
        entityType: 'session',
        entityId: sessionId,
        before: { revoked: false },
        after: { revoked: true },
      });
    });
    return { message: 'Session revoked' };
  }

  async revokeOtherSessions(userId: string, currentSid: string) {
    await this.prisma.$transaction(async (tx) => {
      await tx.session.updateMany({
        where: { userId, revokedAt: null, id: { not: currentSid } },
        data: { revokedAt: new Date() },
      });
      await writeAudit(tx, {
        actor: { id: userId },
        action: 'auth.session_revoke_others',
        entityType: 'user',
        entityId: userId,
        metadata: { keptSessionId: currentSid },
      });
    });
    return { message: 'All other sessions revoked' };
  }

  private async createSession(userId: string, ctx?: RequestContext) {
    const expiresIn = this.config.get<string>('JWT_EXPIRES_IN') ?? '7d';
    const ttlMs = this.parseExpiresIn(expiresIn);
    return this.prisma.session.create({
      data: {
        userId,
        userAgent: ctx?.userAgent ?? null,
        ipAddress: ctx?.ip ?? null,
        expiresAt: new Date(Date.now() + ttlMs),
      },
    });
  }

  private parseExpiresIn(val: string): number {
    const match = val.match(/^(\d+)([smhd])$/);
    if (!match) return DEFAULT_SESSION_TTL_MS;
    const n = parseInt(match[1], 10);
    switch (match[2]) {
      case 's': return n * 1000;
      case 'm': return n * 60 * 1000;
      case 'h': return n * 60 * 60 * 1000;
      case 'd': return n * 24 * 60 * 60 * 1000;
      default: return DEFAULT_SESSION_TTL_MS;
    }
  }

  private isAdminEmail(email: string): boolean {
    const list = (this.config.get<string>('ADMIN_EMAILS') ?? '')
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
    return list.includes(email.trim().toLowerCase());
  }

  private signToken(userId: string, email: string, role: UserRole, sid: string) {
    const access_token = this.jwt.sign({ sub: userId, email, role, sid });
    return { access_token };
  }
}
