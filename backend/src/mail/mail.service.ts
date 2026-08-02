import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

const RESEND_ENDPOINT = 'https://api.resend.com/emails';

/**
 * Transactional email.
 *
 * Two transports, chosen at construction:
 *
 *  - **Resend HTTP API** when RESEND_API_KEY is set. This is the one that
 *    works in production. Managed hosts (Railway, Render, Heroku, Vercel)
 *    block outbound SMTP ports 25/465/587 to stop themselves being used as
 *    spam relays, so nodemailer there fails with `Connection timeout` —
 *    a TCP connect that never completes, before any credential is sent.
 *    Sending over HTTPS on 443 sidesteps that entirely.
 *
 *  - **SMTP via nodemailer** otherwise, so local development against
 *    Mailhog/Mailpit or a self-hosted relay keeps working unchanged.
 *
 * The public methods are transport-agnostic; callers never know which is used.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly resendKey?: string;
  private readonly from: string;
  private transporter?: nodemailer.Transporter;

  constructor(private readonly config: ConfigService) {
    this.resendKey = config.get<string>('RESEND_API_KEY') || undefined;
    // MAIL_FROM is the transport-neutral name; SMTP_FROM is still honoured so
    // existing deployments keep working without an env change.
    this.from =
      config.get<string>('MAIL_FROM') ||
      config.get<string>('SMTP_FROM') ||
      'onboarding@resend.dev';

    if (this.resendKey) {
      this.logger.log(`Mail transport: Resend HTTP API (from ${this.from})`);
    } else {
      this.logger.warn(
        'RESEND_API_KEY not set — falling back to SMTP. Note that most managed hosts block outbound SMTP ports, so this will time out in production.',
      );
      const host = config.get<string>('SMTP_HOST') || 'smtp.gmail.com';
      const port = Number(config.get('SMTP_PORT') ?? 587);
      // 465 is implicit TLS (TLS from the first byte); 587 is STARTTLS, which
      // begins in the clear and upgrades. Getting this wrong hangs rather than
      // erroring cleanly, because each side waits for the other to speak.
      const secure = port === 465;

      this.logger.log(`Mail transport: SMTP ${host}:${port} (secure=${secure})`);
      this.transporter = nodemailer.createTransport({
        host,
        port,
        secure,
        auth: {
          user: config.get<string>('SMTP_USER') || '',
          pass: config.get<string>('SMTP_PASS') || '',
        },
        // Note on the failure seen on Railway: nodemailer resolves both A and
        // AAAA records and tries IPv4 first, falling back to IPv6. The logged
        // error is therefore `ENETUNREACH <ipv6>` — the *last* attempt — even
        // though IPv4 was tried first and timed out. Reading that error alone
        // suggests an IPv6 problem; the elapsed time (a full connectionTimeout
        // before it appears) is what shows IPv4 was attempted and blocked.
        //
        // Without these, an unreachable host hangs for ~2 minutes before
        // nodemailer gives up, making the request look wedged rather than
        // refused.
        connectionTimeout: 10_000,
        greetingTimeout: 10_000,
        socketTimeout: 15_000,
      });
    }
  }

  private async send(to: string, subject: string, html: string) {
    if (!this.resendKey) {
      await this.transporter!.sendMail({
        from: `"Meow" <${this.from}>`,
        to,
        subject,
        html,
      });
      return;
    }

    const res = await fetch(RESEND_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.resendKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: `Meow <${this.from}>`,
        to: [to],
        subject,
        html,
      }),
    });

    if (!res.ok) {
      // Surface Resend's own message — its failures are specific and
      // actionable ("domain is not verified", "You can only send testing
      // emails to your own address"), and a bare status code would send
      // someone hunting through logs for no reason.
      const detail = await res.text().catch(() => '');
      throw new Error(`Resend responded ${res.status}: ${detail.slice(0, 300)}`);
    }
  }

  private frontend(): string {
    return this.config.get<string>('FRONTEND_ORIGIN') || 'http://localhost:3001';
  }

  async sendPasswordResetEmail(to: string, token: string) {
    const link = `${this.frontend()}/auth/reset-password?token=${token}`;
    await this.send(
      to,
      'Reset your password — Meow',
      `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 24px;">
          <h2 style="color: #1a1a1a; font-size: 22px; margin-bottom: 8px;">Reset your password</h2>
          <p style="color: #666; font-size: 15px; line-height: 1.6; margin-bottom: 28px;">
            We received a request to reset your Meow password. Tap the button below to choose a new one.
          </p>
          <a href="${link}"
             style="display: inline-block; background: #E0B259; color: #1a1a1a; font-weight: 700; font-size: 15px; padding: 14px 32px; border-radius: 12px; text-decoration: none;">
            Reset password
          </a>
          <p style="color: #999; font-size: 13px; margin-top: 32px; line-height: 1.5;">
            This link expires in 1 hour. If you didn't request this, you can safely ignore this email — your password won't change.
          </p>
        </div>
      `,
    );
  }

  async sendVerificationEmail(to: string, token: string) {
    const link = `${this.frontend()}/auth/verify-email?token=${token}`;
    await this.send(
      to,
      'Verify your email — Meow',
      `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 24px;">
          <h2 style="color: #1a1a1a; font-size: 22px; margin-bottom: 8px;">Welcome to Meow</h2>
          <p style="color: #666; font-size: 15px; line-height: 1.6; margin-bottom: 28px;">
            Tap the button below to verify your email and unlock all features.
          </p>
          <a href="${link}"
             style="display: inline-block; background: #E0B259; color: #1a1a1a; font-weight: 700; font-size: 15px; padding: 14px 32px; border-radius: 12px; text-decoration: none;">
            Verify email
          </a>
          <p style="color: #999; font-size: 13px; margin-top: 32px; line-height: 1.5;">
            This link expires in 24 hours. If you didn't create an account, ignore this email.
          </p>
        </div>
      `,
    );
  }
}
