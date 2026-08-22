import * as Joi from 'joi';

export const envSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'test', 'production')
    .default('development'),
  PORT: Joi.number().integer().min(1).max(65535).default(3000),
  DATABASE_URL: Joi.string()
    .uri({ scheme: ['postgresql', 'postgres'] })
    .required(),
  /* 32-char min ≈ 256 bits of entropy. Generate via:
       node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
     Rotate in production by deploying a new secret + forcing logout. */
  JWT_SECRET: Joi.string().min(32).required(),
  /* AES-256 key for column encryption, base64 of exactly 32 bytes. Generate:
       node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
     Rotating this needs a re-encryption pass over every encrypted column —
     see scripts/backfill-encryption.ts — so it is not a value to change
     casually. Losing it makes stored account numbers unrecoverable. */
  ENCRYPTION_KEY: Joi.string().base64().length(44).required(),
  JWT_EXPIRES_IN: Joi.string()
    .pattern(/^\d+[smhd]$/)
    .default('7d'),
  /* Browser-reachable base for email links and the post-OAuth redirect.
     Must be a real http(s) URL a mail client can open. */
  FRONTEND_ORIGIN: Joi.string().uri().default('http://localhost:3001'),
  /* Comma-separated CORS allowlist; empty falls back to FRONTEND_ORIGIN, e.g.
       https://app.example.com,https://admin.example.com
     Browsers only — a native client sends no Origin and is unaffected. */
  CORS_ORIGINS: Joi.string().allow('').default(''),
  THROTTLE_TTL_MS: Joi.number().integer().min(1000).default(60000),
  THROTTLE_LIMIT: Joi.number().integer().min(1).default(100),
  TRANSFER_DAILY_LIMIT: Joi.number().min(0).default(10000),
  TRANSFER_TICK_MS: Joi.number().integer().min(1000).default(5000),
  /* How many transfers one tick may advance, and how many at once.
     Concurrency is deliberately well under the Prisma pool (connection_limit
     is 10 in DATABASE_URL) so background work cannot starve HTTP requests of
     connections — a scheduler that makes the API time out is a worse problem
     than a slow scheduler. */
  TRANSFER_TICK_BATCH: Joi.number().integer().min(1).max(1000).default(200),
  TRANSFER_TICK_CONCURRENCY: Joi.number().integer().min(1).max(20).default(4),
  /* Shares WebSocket rooms between instances. Optional: unset means in-memory
     rooms, which is correct on exactly one instance. Set it before scaling to
     two, or customers connected to one replica stop receiving events raised on
     another. See common/ws/redis-io.adapter.ts. */
  REDIS_URL: Joi.string().allow('').default(''),
  ADMIN_EMAILS: Joi.string().allow('').default(''),
  GOOGLE_CLIENT_ID: Joi.string().allow('').default(''),
  GOOGLE_CLIENT_SECRET: Joi.string().allow('').default(''),
  GOOGLE_CALLBACK_URL: Joi.string()
    .uri()
    .default('http://localhost:3000/auth/google/callback'),
  /* Resend HTTP API key. When present it is used instead of SMTP, because
     managed hosts block outbound SMTP ports (25/465/587) and nodemailer there
     fails with a connection timeout before any credential is sent. */
  // Optional, and checked before RESEND_API_KEY. Brevo verifies a single
  // sender address rather than a whole domain, which is what lets mail reach
  // any recipient before a domain exists. See MailService.
  BREVO_API_KEY: Joi.string().allow('').default(''),
  RESEND_API_KEY: Joi.string().allow('').default(''),
  /* Sender address, transport-neutral. Falls back to SMTP_FROM. With Resend
     this must be either a verified domain or onboarding@resend.dev — and the
     latter only delivers to the address the Resend account is registered to. */
  MAIL_FROM: Joi.string().email().allow('').default(''),
  SMTP_HOST: Joi.string().default('smtp.gmail.com'),
  SMTP_PORT: Joi.number().integer().default(587),
  SMTP_USER: Joi.string().allow('').default(''),
  SMTP_PASS: Joi.string().allow('').default(''),
  SMTP_FROM: Joi.string().email().allow('').default(''),
  REFERRAL_REWARD_AMOUNT: Joi.number().min(0).default(15),
}).unknown(true);
