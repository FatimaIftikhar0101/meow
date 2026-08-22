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
import { MfaService } from './mfa.service';
import {
  checkCode,
  codeExpiry,
  generateCode,
  hashCode,
  MAX_ATTEMPTS,
} from './one-time-code';
import { isStaff, permissionsFor } from './permissions';
import { writeAudit } from '../common/audit/audit';
import { MailService } from '../mail/mail.service';
import { ReferralsService } from '../referrals/referrals.service';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import type { GoogleProfile } from './google.strategy';

/** Long enough to fetch a phone from a pocket, short enough that a stolen
 *  challenge token is useless by the time anyone finds it. */
const MFA_CHALLENGE_TTL = '5m';
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
    private readonly mfa: MfaService,
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
    const verifyCode = generateCode();
    const verifyHash = await hashCode(verifyCode);

    const user = await this.prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          email: dto.email,
          passwordHash,
          firstName,
          lastName,
          country: dto.country?.trim() || null,
          emailVerifyToken: verifyHash,
          emailVerifyExpires: codeExpiry(),
        },
      });
      // A customer wallet is a ledger account like any other; the `code` is
      // what makes it findable and unique, since Postgres treats the NULL
      // ownerId of a system account as distinct on the composite key.
      await tx.ledgerAccount.create({
        data: {
          kind: 'customer_wallet',
          ownerId: created.id,
          currency,
          code: `wallet.${created.id}.${currency}`,
        },
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

    this.mail.sendVerificationEmail(user.email, verifyCode).catch(() => {});

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
            authProvider:
              user.authProvider === 'local'
                ? 'local+google'
                : user.authProvider,
            emailVerified: true,
            firstName: user.firstName || profile.firstName || null,
            avatarUrl: user.avatarUrl || profile.avatarUrl || null,
          },
        });
      } else {
        user = await this.prisma.$transaction(async (tx) => {
          const created = await tx.user.create({
            data: {
              email: profile.email,
              authProvider: 'google',
              googleId: profile.googleId,
              emailVerified: true,
              firstName: profile.firstName || null,
              avatarUrl: profile.avatarUrl || null,
            },
          });
          await tx.ledgerAccount.create({
            data: {
              kind: 'customer_wallet',
              ownerId: created.id,
              currency: 'CAD',
              code: `wallet.${created.id}.CAD`,
            },
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

    // Authentication proves who someone is. It does not decide what they may
    // do, and it never writes to the role column. Every role comes from staff
    // management or the one-time bootstrap script, each of which records who
    // granted it and why.
    //
    // This used to re-read ADMIN_EMAILS here on every login. That made the env
    // var an invisible second source of truth: it silently undid demotions made
    // in the panel, it only ever promoted (removing an address revoked nothing),
    // and combined with registration it let anyone who claimed a listed address
    // become an administrator without ever proving they could read that inbox.

    // Which door was used, not which exact role. Staff roles other than admin
    // — support, operations, compliance — must reach the back office, and an
    // exact-match check against 'admin' would have locked every one of them out
    // while telling them they were "not an admin account".
    if (audience === 'staff' && !isStaff(user.role)) {
      throw new ForbiddenException('Not a staff account');
    }
    // Staff must have proved they control the inbox the invite was sent to.
    // It is also the password-reset path, so an unverified staff address is a
    // standing way in for whoever does own it.
    if (audience === 'staff' && !user.emailVerified) {
      throw new ForbiddenException(
        'Verify your email address before signing in to the back office',
      );
    }
    if (audience === 'customer' && isStaff(user.role)) {
      throw new ForbiddenException('Use the admin portal');
    }

    // The password was right, but for enrolled staff it is only the first
    // half. Hand back a challenge rather than a session: this token carries
    // no session id, so JwtStrategy rejects it everywhere a real one works.
    if (audience === 'staff' && user.mfaEnabledAt) {
      return {
        mfaRequired: true as const,
        mfaToken: this.jwt.sign(
          { sub: user.id, typ: 'mfa' },
          { expiresIn: MFA_CHALLENGE_TTL },
        ),
      };
    }

    return this.issueSession(user, audience, ctx);
  }

  /**
   * Second half of a staff sign-in.
   *
   * Deliberately vague about which half failed. Telling an attacker that the
   * password was right and only the code was wrong confirms a valid
   * credential, which is the more valuable of the two things to learn.
   */
  async completeMfaLogin(mfaToken: string, code: string, ctx?: RequestContext) {
    let payload: { sub?: string; typ?: string };
    try {
      payload = this.jwt.verify(mfaToken);
    } catch {
      throw new UnauthorizedException(
        'That sign-in attempt expired. Start again.',
      );
    }
    if (payload.typ !== 'mfa' || !payload.sub) {
      throw new UnauthorizedException('Invalid sign-in token');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });
    if (!user || user.suspended || !isStaff(user.role)) {
      throw new UnauthorizedException('Invalid sign-in token');
    }

    if (!(await this.mfa.verify(user.id, code))) {
      await writeAudit(this.prisma, {
        actor: { id: user.id, email: user.email },
        action: 'auth.mfa.failed',
        entityType: 'user',
        entityId: user.id,
        context: { ip: ctx?.ip, userAgent: ctx?.userAgent },
      });
      throw new UnauthorizedException('Invalid or expired code');
    }

    return this.issueSession(user, 'staff', ctx);
  }

  private async issueSession(
    user: { id: string; email: string; role: UserRole },
    audience: 'customer' | 'staff' | undefined,
    ctx?: RequestContext,
  ) {
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
      // What this account may actually do, so the back office builds its
      // navigation from capabilities rather than from role names. A client that
      // hardcodes `role === admin` drifts the moment a capability moves between
      // roles; PermissionsGuard remains the enforcement either way.
      permissions: permissionsFor(user.role),
      emailVerified: user.emailVerified,
      createdAt: user.createdAt,
    };
  }

  async changePassword(
    userId: string,
    dto: ChangePasswordDto,
    ctx?: RequestContext,
  ) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException();
    if (!user.passwordHash) {
      throw new BadRequestException(
        'This account uses Google sign-in and has no password to change',
      );
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
      return {
        message: 'If that email is registered, a reset link has been sent',
      };
    }
    const resetCode = generateCode();
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        pwResetToken: await hashCode(resetCode),
        pwResetExpires: codeExpiry(),
        // A new code resets the budget. Otherwise someone who fumbled the
        // last one five times could never use a fresh one either.
        pwResetAttempts: 0,
      },
    });
    await writeAudit(this.prisma, {
      actor: { id: user.id, email: user.email },
      action: 'auth.forgot_password',
      entityType: 'user',
      entityId: user.id,
    });
    this.mail.sendPasswordResetEmail(user.email, resetCode).catch(() => {});
    return {
      message: 'If that email is registered, a reset link has been sent',
    };
  }

  /**
   * Set a new password from a six-digit code.
   *
   * The email is part of the input because a six-digit code is not unique on
   * its own — without it an attacker guesses against every outstanding code
   * at once rather than against one account.
   */
  async resetPassword(dto: ResetPasswordDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.trim().toLowerCase() },
    });

    // Same words for every failure below. Distinguishing "no such account"
    // from "wrong code" would turn this endpoint into a way to discover who
    // has an account here.
    const reject = () =>
      new BadRequestException('That code is not valid. Request a new one.');

    if (!user) throw reject();

    const check = await checkCode(dto.code, {
      hash: user.pwResetToken,
      expires: user.pwResetExpires,
      attempts: user.pwResetAttempts,
    });

    if (!check.ok) {
      // Persisting the increment is the whole rate limit. A check that does
      // not record the failed attempt caps nothing.
      if (check.attempts !== user.pwResetAttempts) {
        await this.prisma.user.update({
          where: { id: user.id },
          data: { pwResetAttempts: check.attempts },
        });
      }
      if (check.attempts >= MAX_ATTEMPTS) {
        await writeAudit(this.prisma, {
          actor: { id: user.id, email: user.email },
          action: 'auth.reset_code_locked',
          entityType: 'user',
          entityId: user.id,
        });
      }
      throw reject();
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
          pwResetAttempts: 0,
          // Completing a reset proves the person reads that inbox, which is the
          // same thing the verification email establishes. It also makes the
          // staff invite flow work: an invitee claims their account through
          // this path, and staff sign-in requires a verified address.
          emailVerified: true,
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

  async verifyEmail(email: string, code: string) {
    const user = await this.prisma.user.findUnique({
      where: { email: email.trim().toLowerCase() },
    });
    const reject = () =>
      new BadRequestException('That code is not valid. Request a new one.');

    if (!user) throw reject();
    if (user.emailVerified) {
      return { message: 'Email already verified' };
    }

    const check = await checkCode(code, {
      hash: user.emailVerifyToken,
      expires: user.emailVerifyExpires,
      attempts: user.emailVerifyAttempts,
    });
    if (!check.ok) {
      if (check.attempts !== user.emailVerifyAttempts) {
        await this.prisma.user.update({
          where: { id: user.id },
          data: { emailVerifyAttempts: check.attempts },
        });
      }
      throw reject();
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: user.id },
        data: {
          emailVerified: true,
          emailVerifyToken: null,
          emailVerifyExpires: null,
          emailVerifyAttempts: 0,
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
    const verifyCode = generateCode();
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        emailVerifyToken: await hashCode(verifyCode),
        emailVerifyExpires: codeExpiry(),
        emailVerifyAttempts: 0,
      },
    });
    await this.mail.sendVerificationEmail(user.email, verifyCode);
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
      case 's':
        return n * 1000;
      case 'm':
        return n * 60 * 1000;
      case 'h':
        return n * 60 * 60 * 1000;
      case 'd':
        return n * 24 * 60 * 60 * 1000;
      default:
        return DEFAULT_SESSION_TTL_MS;
    }
  }

  private signToken(
    userId: string,
    email: string,
    role: UserRole,
    sid: string,
  ) {
    const access_token = this.jwt.sign({ sub: userId, email, role, sid });
    return { access_token };
  }
}
