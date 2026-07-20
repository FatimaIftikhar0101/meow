import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private transporter: nodemailer.Transporter;
  private from: string;

  constructor(private readonly config: ConfigService) {
    this.from = config.get<string>('SMTP_FROM') || 'fatimaiftikhar0101@gmail.com';
    this.transporter = nodemailer.createTransport({
      host: config.get<string>('SMTP_HOST') || 'smtp.gmail.com',
      port: config.get<number>('SMTP_PORT') || 587,
      secure: false,
      auth: {
        user: config.get<string>('SMTP_USER') || '',
        pass: config.get<string>('SMTP_PASS') || '',
      },
    });
  }

  async sendVerificationEmail(to: string, token: string) {
    const frontend =
      this.config.get<string>('FRONTEND_ORIGIN') || 'http://localhost:3001';
    const link = `${frontend}/auth/verify-email?token=${token}`;

    await this.transporter.sendMail({
      from: `"Meow" <${this.from}>`,
      to,
      subject: 'Verify your email — Meow',
      html: `
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
    });
  }
}
