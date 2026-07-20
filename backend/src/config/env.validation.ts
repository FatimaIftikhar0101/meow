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
  JWT_EXPIRES_IN: Joi.string()
    .pattern(/^\d+[smhd]$/)
    .default('7d'),
  FRONTEND_ORIGIN: Joi.string().uri().default('http://localhost:3001'),
  THROTTLE_TTL_MS: Joi.number().integer().min(1000).default(60000),
  THROTTLE_LIMIT: Joi.number().integer().min(1).default(100),
  TRANSFER_DAILY_LIMIT: Joi.number().min(0).default(10000),
  TRANSFER_TICK_MS: Joi.number().integer().min(1000).default(5000),
  ADMIN_EMAILS: Joi.string().allow('').default(''),
  GOOGLE_CLIENT_ID: Joi.string().allow('').default(''),
  GOOGLE_CLIENT_SECRET: Joi.string().allow('').default(''),
  GOOGLE_CALLBACK_URL: Joi.string().uri().default('http://localhost:3000/auth/google/callback'),
}).unknown(true);
