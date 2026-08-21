import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

const RESEND_ENDPOINT = 'https://api.resend.com/emails';
const BREVO_ENDPOINT = 'https://api.brevo.com/v3/smtp/email';

/**
 * Transactional email.
 *
 * Three transports, chosen at construction in this order:
 *
 *  - **Brevo HTTP API** when BREVO_API_KEY is set. Brevo verifies a *single
 *    sender address* rather than a whole domain, which is the one thing that
 *    matters before you own a domain: a shared test sender — Resend's
 *    `onboarding@resend.dev`, and every provider has an equivalent — will only
 *    deliver to the account owner's own inbox. That is not a setting; it is
 *    what stops anyone sending mail as anyone. Verifying one address you
 *    control lifts it, and you can then send to anybody.
 *
 *  - **Resend HTTP API** when RESEND_API_KEY is set. The better long-term
 *    choice *once a domain exists*, because a verified domain with SPF and
 *    DKIM is what actually keeps mail out of spam folders.
 *
 *  - **SMTP via nodemailer** otherwise, so local development against
 *    Mailhog/Mailpit or a self-hosted relay keeps working unchanged.
 *
 * Both HTTP transports exist because managed hosts (Railway, Render, Heroku,
 * Vercel) block outbound SMTP ports 25/465/587 to stop themselves being used
 * as spam relays. Nodemailer there fails with `Connection timeout` — a TCP
 * connect that never completes, before any credential is sent. Sending over
 * HTTPS on 443 sidesteps that entirely.
 *
 * The public methods are transport-agnostic; callers never know which is used.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly resendKey?: string;
  private readonly brevoKey?: string;
  private readonly from: string;
  private transporter?: nodemailer.Transporter;

  constructor(private readonly config: ConfigService) {
    this.brevoKey = config.get<string>('BREVO_API_KEY') || undefined;
    this.resendKey = config.get<string>('RESEND_API_KEY') || undefined;
    // MAIL_FROM is the transport-neutral name; SMTP_FROM is still honoured so
    // existing deployments keep working without an env change.
    this.from =
      config.get<string>('MAIL_FROM') ||
      config.get<string>('SMTP_FROM') ||
      'onboarding@resend.dev';

    if (this.brevoKey) {
      this.logger.log(`Mail transport: Brevo HTTP API (from ${this.from})`);
      if (/@(gmail|yahoo|outlook|hotmail)\./i.test(this.from)) {
        // Not fatal, and worth saying every boot. A consumer mailbox as the
        // sender fails the receiving side's DMARC alignment check, so the mail
        // is delivered but is far more likely to be filtered. Fine for testing,
        // not something to hand over.
        this.logger.warn(
          `MAIL_FROM is a consumer address (${this.from}). Delivery will work but ` +
            'spam placement is likely — verify a domain before this goes to real users.',
        );
      }
    } else if (this.resendKey) {
      this.logger.log(`Mail transport: Resend HTTP API (from ${this.from})`);
      if (this.from.endsWith('@resend.dev')) {
        this.logger.warn(
          'MAIL_FROM is Resend’s shared test sender, which only delivers to the ' +
            'address that owns the Resend account. Verify a domain, or set ' +
            'BREVO_API_KEY to send from a single verified address instead.',
        );
      }
    } else {
      this.logger.warn(
        'No mail API key set (BREVO_API_KEY or RESEND_API_KEY) — falling back to SMTP. Most managed hosts block outbound SMTP ports, so this will time out in production.',
      );
      const host = config.get<string>('SMTP_HOST') || 'smtp.gmail.com';
      const port = Number(config.get('SMTP_PORT') ?? 587);
      // 465 is implicit TLS (TLS from the first byte); 587 is STARTTLS, which
      // begins in the clear and upgrades. Getting this wrong hangs rather than
      // erroring cleanly, because each side waits for the other to speak.
      const secure = port === 465;

      this.logger.log(
        `Mail transport: SMTP ${host}:${port} (secure=${secure})`,
      );
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
    if (this.brevoKey) {
      await this.post(
        'Brevo',
        BREVO_ENDPOINT,
        { 'api-key': this.brevoKey, accept: 'application/json' },
        {
          sender: { name: 'Meow', email: this.from },
          to: [{ email: to }],
          subject,
          htmlContent: html,
        },
      );
      return;
    }

    if (this.resendKey) {
      await this.post(
        'Resend',
        RESEND_ENDPOINT,
        { Authorization: `Bearer ${this.resendKey}` },
        { from: `Meow <${this.from}>`, to: [to], subject, html },
      );
      return;
    }

    await this.transporter!.sendMail({
      from: `"Meow" <${this.from}>`,
      to,
      subject,
      html,
    });
  }

  /**
   * One HTTP send, shared by both API transports.
   *
   * Surfaces the provider's own message rather than a bare status code. Their
   * failures are specific and actionable — "domain is not verified", "You can
   * only send testing emails to your own address", "sender not valid" — and
   * swallowing them sends someone hunting through logs for a problem the
   * response already named.
   */
  private async post(
    provider: string,
    endpoint: string,
    headers: Record<string, string>,
    body: unknown,
  ) {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new Error(
        `${provider} responded ${res.status}: ${detail.slice(0, 300)}`,
      );
    }
  }

  /**
   * The body of a code email.
   *
   * Deliberately plain. Without a verified domain this mail is already scored
   * down by every receiving server, and heavy HTML with images and buttons is
   * the other thing filters weight against — so there is nothing here but the
   * code and a sentence saying what it is for.
   *
   * No link, on purpose. Mail scanners fetch URLs to check them, which spends
   * a single-use token before its owner has opened the message; the user then
   * clicks and is told it is invalid. A code cannot be consumed by being read.
   */
  private codeBody(
    heading: string,
    purpose: string,
    code: string,
    expiry = 'This code expires in 15 minutes and can be used once.',
  ): string {
    return `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 24px;">
        <h2 style="color: #3C3C3C; font-size: 22px; margin-bottom: 8px;">${heading}</h2>
        <p style="color: #66737A; font-size: 15px; line-height: 1.6; margin-bottom: 24px;">${purpose}</p>
        <p style="font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 32px; letter-spacing: 8px; color: #3C3C3C; background: #F4F7F8; padding: 16px 24px; border-radius: 12px; text-align: center; margin: 0;">${code}</p>
        <p style="color: #8A959B; font-size: 13px; margin-top: 28px; line-height: 1.5;">
          ${expiry} If you didn't ask for it, ignore this email — nothing will change.
        </p>
      </div>
    `;
  }

  async sendPasswordResetEmail(to: string, code: string) {
    await this.send(
      to,
      'Your Meow password reset code',
      this.codeBody(
        'Reset your password',
        'Enter this code in the app to choose a new password.',
        code,
      ),
    );
  }

  /**
   * A back-office setup code, for an admin who chose to email it as well as
   * reading it out.
   *
   * Separate from the reset email because the words matter to the person
   * receiving it: this is a new account they were told to expect, not a
   * password reset they did not ask for. The expiry differs too — a setup code
   * lives two hours, not fifteen minutes.
   *
   * Sending this is never the only delivery. The code is on the inviting
   * admin's screen either way, so a message that lands in spam delays somebody
   * rather than stranding them.
   */
  async sendStaffSetupEmail(to: string, code: string, expiresInMinutes: number) {
    const hours = expiresInMinutes / 60;
    const window =
      hours >= 1
        ? `${hours} hour${hours === 1 ? '' : 's'}`
        : `${expiresInMinutes} minutes`;
    await this.send(
      to,
      'Your Meow back-office setup code',
      this.codeBody(
        'Set up your back-office account',
        'An administrator created an account for you. Open the Meow back ' +
          'office, choose "I have a setup code", and enter this with your ' +
          'email address to choose a password.',
        code,
        `This code expires in ${window} and can be used once.`,
      ),
    );
  }

  async sendVerificationEmail(to: string, code: string) {
    await this.send(
      to,
      'Your Meow verification code',
      this.codeBody(
        'Verify your email',
        'Enter this code in the app to confirm this address is yours.',
        code,
      ),
    );
  }
}
