import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import type { AuthUser } from './decorators/current-user.decorator';
import { CurrentUser } from './decorators/current-user.decorator';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { GoogleNativeDto } from './dto/google-native.dto';
import { LoginDto } from './dto/login.dto';
import { MfaCodeDto, MfaLoginDto } from './dto/mfa.dto';
import { RegisterDto } from './dto/register.dto';
import { ResetPasswordDto, VerifyEmailDto } from './dto/reset-password.dto';
import { AuthService } from './auth.service';
import { MfaService } from './mfa.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import type { GoogleProfile } from './google.strategy';
import { GoogleEnabledGuard } from './google-enabled.guard';

function extractCtx(req: Request) {
  return {
    ip: req.ip ?? undefined,
    userAgent: req.headers['user-agent'] ?? undefined,
  };
}

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly mfa: MfaService,
    private readonly config: ConfigService,
  ) {}

  @Post('register')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  register(@Body() dto: RegisterDto, @Req() req: Request) {
    return this.auth.register(dto, extractCtx(req));
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  login(@Body() dto: LoginDto, @Req() req: Request) {
    return this.auth.login(dto, 'customer', extractCtx(req));
  }

  @Post('admin/login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  adminLogin(@Body() dto: LoginDto, @Req() req: Request) {
    return this.auth.login(dto, 'staff', extractCtx(req));
  }

  /**
   * Second half of a staff sign-in, exchanging the challenge for a session.
   *
   * Throttled harder than the password endpoint: a six-digit code is only
   * a million possibilities, and the challenge lives for five minutes.
   */
  @Post('admin/login/mfa')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  adminLoginMfa(@Body() dto: MfaLoginDto, @Req() req: Request) {
    return this.auth.completeMfaLogin(dto.mfaToken, dto.code, extractCtx(req));
  }

  /**
   * Start two-factor enrolment.
   *
   * Behind JwtAuthGuard but deliberately not behind StaffGuard — an
   * un-enrolled staff member has to be able to reach exactly this and
   * nothing else, which is the whole shape of the requirement.
   */
  @Post('mfa/enrol')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  beginMfaEnrolment(@CurrentUser() user: AuthUser) {
    return this.mfa.beginEnrolment(user.id, user.email);
  }

  @Post('mfa/confirm')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  confirmMfaEnrolment(@CurrentUser() user: AuthUser, @Body() dto: MfaCodeDto) {
    return this.mfa.confirmEnrolment(user.id, user.email, dto.code);
  }

  @Get('profile')
  @UseGuards(JwtAuthGuard)
  profile(@CurrentUser() user: AuthUser) {
    return this.auth.profile(user.id);
  }

  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  changePassword(
    @CurrentUser() user: AuthUser,
    @Body() dto: ChangePasswordDto,
    @Req() req: Request,
  ) {
    return this.auth.changePassword(user.id, dto, extractCtx(req));
  }

  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.auth.forgotPassword(dto);
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.auth.resetPassword(dto);
  }

  // POST, not GET. A verification link was a GET that changed state, which is
  // how mail scanners fetching URLs consumed the token before the recipient
  // opened the message. A code posted from a form cannot be spent by a fetch.
  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  verifyEmail(@Body() dto: VerifyEmailDto) {
    return this.auth.verifyEmail(dto.email, dto.code);
  }

  @Post('resend-verification')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  resendVerification(@CurrentUser() user: AuthUser) {
    return this.auth.resendVerification(user.id);
  }

  @Get('google')
  @UseGuards(GoogleEnabledGuard, AuthGuard('google'))
  googleAuth() {
    // Passport redirects to Google — this body never runs.
  }

  /**
   * The native counterpart to the /auth/google redirect flow above. Same guard,
   * so both are disabled together when Google is not configured.
   */
  @Post('google/native')
  @HttpCode(HttpStatus.OK)
  @UseGuards(GoogleEnabledGuard)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  googleNative(@Body() dto: GoogleNativeDto, @Req() req: Request) {
    return this.auth.googleNativeLogin(dto.idToken, extractCtx(req));
  }

  @Get('google/callback')
  @UseGuards(GoogleEnabledGuard, AuthGuard('google'))
  async googleCallback(@Req() req: Request, @Res() res: Response) {
    const { access_token } = await this.auth.googleLogin(
      req.user as GoogleProfile,
      extractCtx(req),
    );
    const frontend =
      this.config.get<string>('FRONTEND_ORIGIN') || 'http://localhost:3001';
    res.redirect(`${frontend}/auth/google/callback?token=${access_token}`);
  }

  // ─── Session management ──────────────────────────────────────────────

  @Get('sessions')
  @UseGuards(JwtAuthGuard)
  listSessions(@CurrentUser() user: AuthUser) {
    return this.auth.listSessions(user.id, user.sid);
  }

  @Delete('sessions/:id')
  @UseGuards(JwtAuthGuard)
  revokeSession(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.auth.revokeSession(user.id, id);
  }

  /**
   * End the current session.
   *
   * Sign-out used to be entirely client-side: drop the token and forget it.
   * That leaves a token that is still valid until it expires, which is fine
   * while the client is the only place it exists — and not fine once it is
   * also written to an OS credential store that might fail to erase it.
   *
   * Revoking here means a copy left behind anywhere is already worthless, so
   * the guarantee does not depend on the client succeeding at cleanup.
   */
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  logout(@CurrentUser() user: AuthUser) {
    return this.auth.revokeSession(user.id, user.sid);
  }

  @Post('sessions/revoke-others')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  revokeOtherSessions(@CurrentUser() user: AuthUser) {
    return this.auth.revokeOtherSessions(user.id, user.sid);
  }
}
