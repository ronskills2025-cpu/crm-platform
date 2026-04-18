import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// Resolve .env from the monorepo root, not the cwd of whichever app is running
function loadEnv(): void {
  // Walk up from this file until we find a .env (monorepo root) or hit drive root
  let dir = __dirname;
  for (let i = 0; i < 8; i++) {
    const candidate = path.join(dir, '.env');
    if (fs.existsSync(candidate)) {
      dotenv.config({ path: candidate });
      return;
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  // Fallback: default cwd behavior
  dotenv.config();
}

loadEnv();

function env(key: string, fallback = ''): string {
  return process.env[key] || fallback;
}
function envInt(key: string, fallback: number): number {
  const v = process.env[key];
  return v ? parseInt(v, 10) : fallback;
}

export const config = {
  port: envInt('PORT', 4000),
  nodeEnv: env('NODE_ENV', 'development'),
  databaseUrl: env('DATABASE_URL'),
  redisUrl: env('REDIS_URL', ''),  // Empty = disabled, uses in-memory fallback
  frontendUrl: env('FRONTEND_URL', 'http://localhost:5173'),

  // Supabase configuration (optional - for Supabase-specific features)
  supabase: {
    url: env('SUPABASE_URL'),
    anonKey: env('SUPABASE_ANON_KEY'),
    serviceRoleKey: env('SUPABASE_SERVICE_ROLE_KEY'),
  },

  whatsapp: {
    phoneNumberId: env('WHATSAPP_PHONE_NUMBER_ID'),
    accessToken: env('WHATSAPP_ACCESS_TOKEN'),
    apiVersion: env('WHATSAPP_API_VERSION', 'v21.0'),
    verifyToken: env('WHATSAPP_VERIFY_TOKEN'),
    webhookUrl: env('WHATSAPP_WEBHOOK_URL'),
    providers: [
      {
        name: 'meta',
        phoneNumberId: env('WHATSAPP_PHONE_NUMBER_ID'),
        accessToken: env('WHATSAPP_ACCESS_TOKEN'),
        costPerMsg: 0,
      },
      {
        name: 'meta_backup',
        phoneNumberId: env('WHATSAPP_BACKUP_PHONE_NUMBER_ID'),
        accessToken: env('WHATSAPP_BACKUP_ACCESS_TOKEN'),
        costPerMsg: 0,
      },
    ],
    ratePerSec: envInt('WHATSAPP_RATE_PER_SEC', 80),
    concurrency: envInt('WHATSAPP_CONCURRENCY', 25),
    batchSize: envInt('WHATSAPP_BATCH_SIZE', 100),
  },

  sms: {
    providers: [
      {
        name: 'fast2sms',
        apiKey: env('FAST2SMS_API_KEY'),
        costPerMsg: 0.15,
        senderId: env('FAST2SMS_SENDER_ID'),
      },
      {
        name: 'msg91',
        authKey: env('MSG91_AUTH_KEY'),
        senderId: env('MSG91_SENDER_ID'),
        costPerMsg: 0.20,
      },
      {
        name: 'textlocal',
        apiKey: env('TEXTLOCAL_API_KEY'),
        sender: env('TEXTLOCAL_SENDER'),
        costPerMsg: 0.25,
      },
    ],
    dltEntityId: env('DLT_ENTITY_ID'),
    ratePerSec: envInt('SMS_RATE_PER_SEC', 50),
    concurrency: envInt('SMS_CONCURRENCY', 50),
    batchSize: envInt('SMS_BATCH_SIZE', 200),
  },

  email: {
    providers: [
      { name: 'resend', apiKey: env('RESEND_API_KEY'), costPerMsg: 0 },
      { name: 'sendgrid', apiKey: env('SENDGRID_API_KEY'), costPerMsg: 0 },
      {
        name: 'smtp',
        host: env('SMTP_HOST', 'smtp.gmail.com'),
        port: envInt('SMTP_PORT', 587),
        user: env('SMTP_USER'),
        pass: env('SMTP_PASS'),
        costPerMsg: 0,
      },
    ],
    from: env('EMAIL_FROM', 'noreply@yourdomain.com'),
    ratePerSec: envInt('EMAIL_RATE_PER_SEC', 14),
    concurrency: envInt('EMAIL_CONCURRENCY', 30),
    batchSize: envInt('EMAIL_BATCH_SIZE', 100),
  },

  maxRetries: envInt('MAX_RETRIES', 3),
  providerUnhealthyThreshold: envInt('PROVIDER_UNHEALTHY_THRESHOLD', 50),
  providerUnhealthyCooldown: envInt('PROVIDER_UNHEALTHY_COOLDOWN', 300),

  jwt: {
    secret: env('JWT_SECRET', 'dev-secret-change-in-production'),
    expiresIn: env('JWT_EXPIRES_IN', '7d'),
  },

  stripe: {
    secretKey: env('STRIPE_SECRET_KEY', ''),
    webhookSecret: env('STRIPE_WEBHOOK_SECRET', ''),
    plans: {
      starter: {
        priceId: env('STRIPE_PRICE_STARTER', 'price_starter'),
        amount: 99900,       // ₹999 in paise
        maxNumbers: 10,
        maxMessages: 10000,
      },
      pro: {
        priceId: env('STRIPE_PRICE_PRO', 'price_pro'),
        amount: 299900,      // ₹2999 in paise
        maxNumbers: 50,
        maxMessages: 100000,
      },
      enterprise: {
        priceId: env('STRIPE_PRICE_ENTERPRISE', 'price_enterprise'),
        amount: 999900,      // ₹9999 in paise
        maxNumbers: 500,
        maxMessages: 1000000,
      },
    },
  },

  shopify: {
    webhookSecret: env('SHOPIFY_WEBHOOK_SECRET', ''),
    cartRecoveryDelayMs: envInt('CART_RECOVERY_DELAY_MS', 10 * 60 * 1000),    // 10 min
    cartFollowupDelayMs: envInt('CART_FOLLOWUP_DELAY_MS', 60 * 60 * 1000),    // 1 hr
  },

  telegram: {
    providers: [
      {
        name: 'telegram_bot',
        botToken: env('TELEGRAM_BOT_TOKEN'),
        costPerMsg: 0,
      },
      {
        name: 'telegram_bot_backup',
        botToken: env('TELEGRAM_BOT_BACKUP_TOKEN'),
        costPerMsg: 0,
      },
    ],
    webhookSecret: env('TELEGRAM_WEBHOOK_SECRET', ''),
    webhookUrl: env('TELEGRAM_WEBHOOK_URL', ''),
    ratePerSec: envInt('TELEGRAM_RATE_PER_SEC', 30),
    concurrency: envInt('TELEGRAM_CONCURRENCY', 20),
    batchSize: envInt('TELEGRAM_BATCH_SIZE', 100),
  },

  messenger: {
    providers: [
      {
        name: 'fb_page',
        pageAccessToken: env('FB_PAGE_ACCESS_TOKEN'),
        pageId: env('FB_PAGE_ID'),
        costPerMsg: 0,
      },
      {
        name: 'fb_page_backup',
        pageAccessToken: env('FB_PAGE_BACKUP_ACCESS_TOKEN'),
        pageId: env('FB_PAGE_BACKUP_ID'),
        costPerMsg: 0,
      },
    ],
    appSecret: env('FB_APP_SECRET', ''),
    verifyToken: env('FB_VERIFY_TOKEN'),
    apiVersion: env('FB_API_VERSION', 'v21.0'),
    ratePerSec: envInt('FB_RATE_PER_SEC', 200),
    concurrency: envInt('FB_CONCURRENCY', 30),
    batchSize: envInt('FB_BATCH_SIZE', 100),
  },

  instagram: {
    providers: [
      {
        name: 'instagram_main',
        accessToken: env('INSTAGRAM_ACCESS_TOKEN'),
        costPerMsg: 0,
      },
      {
        name: 'instagram_backup',
        accessToken: env('INSTAGRAM_BACKUP_ACCESS_TOKEN'),
        costPerMsg: 0,
      },
    ],
    verifyToken: env('INSTAGRAM_VERIFY_TOKEN'),
    appSecret: env('INSTAGRAM_APP_SECRET', ''),
    webhookUrl: env('INSTAGRAM_WEBHOOK_URL', ''),
    ratePerSec: envInt('INSTAGRAM_RATE_PER_SEC', 30),
    concurrency: envInt('INSTAGRAM_CONCURRENCY', 20),
    batchSize: envInt('INSTAGRAM_BATCH_SIZE', 100),
  },
};

// Production safety checks
if (config.nodeEnv === 'production') {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'dev-secret-change-in-production') {
    throw new Error('JWT_SECRET environment variable must be set to a strong secret in production');
  }
  if (process.env.JWT_SECRET.length < 32) {
    throw new Error('JWT_SECRET must be at least 32 characters in production');
  }
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL environment variable is required in production');
  }
}
