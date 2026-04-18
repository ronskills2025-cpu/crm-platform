/**
 * apps/api/src/server.ts — Modular API Entry Point
 *
 * This server imports routes from isolated modules instead of flat files.
 * All existing API paths are preserved for backward compatibility.
 *
 * Architecture:
 *   @packages/db     → Database + Redis connections
 *   @packages/config → Environment configuration
 *   @packages/utils  → Logger, auth middleware, rate limiter
 *   @modules/*       → Feature modules (routes, controllers, services)
 */

import express from 'express';
import http from 'http';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { WebSocketServer, WebSocket } from 'ws';
import crypto from 'crypto';

// ── Shared Packages ───────────────────────────────────────────────
import { config } from '../../../packages/config/src';
import { redisSub, connectRedis, isRedisAvailable } from '../../../packages/db/src/redis';
import { connectDb, pool } from '../../../packages/db/src/connection';
import { createLogger } from '../../../packages/utils/src/logger';
import { rateLimiter } from '../../../packages/utils/src/rate-limiter';

// ── Database Migrations (from modules) ────────────────────────────
import { migrate } from '../../../packages/db/src/migrate';
import { saasMigrate } from '../../../modules/wa-saas/backend/saas-migrate';
import { productsMigrate } from '../../../modules/products/backend/products-migrate';
import { productsMigrateV2 } from '../../../modules/products/backend/products-migrate-v2';
import { instagramMigrate } from '../../../modules/instagram/backend/instagram-migrate';
import { growthMigrate } from '../../../modules/growth/backend/growth-migrate';
import { waSaasMigrate } from '../../../modules/wa-saas/backend/saas-migrate';
import { qrPaymentMigrate } from '../../../modules/qr-payment/backend/qr-payment-migrate';
import { telegramMigrate } from '../../../modules/telegram/backend/telegram-migrate';
import { messengerMigrate } from '../../../modules/messenger/backend/messenger-migrate';
import { tenantIsolationMigrate } from '../../../modules/users/backend/tenant-isolation-migrate';
import { smsMigrate } from '../../../modules/sms/backend/sms-migrate';
import { waChatMigrate } from '../../../modules/wa-chat/backend/wa-chat-migrate';
import { leadsMigrateV2 } from '../../../modules/leads/backend/leads-v2-migrate';

// ── Module Routes ─────────────────────────────────────────────────
// Channels
import whatsappRoutes from '../../../modules/whatsapp/backend/whatsapp.routes';
import smsRoutes from '../../../modules/sms/backend/sms.routes';
import emailRoutes from '../../../modules/email/backend/email.routes';
import telegramRoutes from '../../../modules/telegram/backend/telegram.routes';
import messengerRoutes from '../../../modules/messenger/backend/messenger.routes';
import instagramRoutes from '../../../modules/instagram/backend/instagram.routes';

// Core
import campaignRoutes from '../../../modules/campaigns/backend/campaign.routes';
import templateRoutes from '../../../modules/campaigns/backend/template.routes';
import inboxRoutes from '../../../modules/inbox/backend/inbox.routes';
import leadsRoutes from '../../../modules/leads/backend/leads.routes';
import analyticsRoutes from '../../../modules/analytics/backend/analytics.routes';
import automationRoutes from '../../../modules/automation/backend/automation.routes';

// Users & Auth
import authRoutes from '../../../modules/users/backend/auth.routes';
import adminRoutes from '../../../modules/users/backend/admin.routes';
import tenantRoutes from '../../../modules/users/backend/tenant.routes';

// Billing
import billingRoutes from '../../../modules/billing/backend/billing.routes';

// Products suite
import funnelRoutes from '../../../modules/products/backend/funnel.routes';
import appointmentRoutes from '../../../modules/products/backend/appointment.routes';
import paymentBotRoutes from '../../../modules/products/backend/payment-bot.routes';
import reviewRoutes from '../../../modules/products/backend/review.routes';
import productDashboardRoutes from '../../../modules/products/backend/product-dashboard.routes';
import eventRoutes from '../../../modules/products/backend/event.routes';
import catalogRoutes from '../../../modules/products/backend/catalog.routes';
import surveyRoutes from '../../../modules/products/backend/survey.routes';
import membershipRoutes from '../../../modules/products/backend/membership.routes';

// Growth & SaaS
import growthRoutes from '../../../modules/growth/backend/growth.routes';
import waSaasRoutes from '../../../modules/wa-saas/backend/wa-saas.routes';
import waChatRoutes from '../../../modules/wa-chat/backend/wa-chat.routes';

// Payments & E-commerce
import qrPaymentRoutes from '../../../modules/qr-payment/backend/qr-payment.routes';
import shopifyRoutes from '../../../modules/ecommerce/backend/shopify.routes';

// Admin controller for webhook verification
import { AdminController } from '../../../modules/users/backend/admin.controller';

// Bot Manager
import botRoutes from '../../../modules/bot-manager/backend/bot.routes';
import { runBotMigration } from '../../../modules/bot-manager/backend/bot-migrate';

const log = createLogger('server');
const app = express();
const server = http.createServer(app);

// ── WebSocket server ──────────────────────────────────────────────
const wss = new WebSocketServer({ server, path: '/ws' });
const clients = new Set<WebSocket>();

wss.on('error', (err: NodeJS.ErrnoException) => {
  if (err.code === 'EADDRINUSE') {
    log.error(`Port ${config.port} already in use. Kill the existing process and restart.`);
    process.exit(1);
  }
  log.error(`WebSocket server error: ${err.message}`);
});

wss.on('connection', (ws: WebSocket) => {
  clients.add(ws);
  ws.send(JSON.stringify({ event: 'connected', data: { timestamp: Date.now() } }));

  const heartbeat = setInterval(() => {
    if (ws.readyState === WebSocket.OPEN) ws.ping();
  }, 30_000);

  ws.on('close', () => { clients.delete(ws); clearInterval(heartbeat); });
  ws.on('error', () => { clients.delete(ws); clearInterval(heartbeat); });
});

function broadcast(event: string, data: unknown) {
  const payload = JSON.stringify({ event, data });
  for (const ws of clients) {
    if (ws.readyState === WebSocket.OPEN) ws.send(payload);
  }
}

function setupRedisBroadcast() {
  if (!isRedisAvailable()) {
    log.warn('Redis unavailable – WebSocket broadcast disabled');
    return;
  }

  const channels = [
    // WhatsApp
    'whatsapp:sent', 'whatsapp:failed', 'whatsapp:batch_queued', 'whatsapp:message_failed',
    'whatsapp:provider_unhealthy', 'whatsapp:provider_status',
    // SMS
    'sms:sent', 'sms:failed', 'sms:batch_queued', 'sms:message_failed',
    'sms:provider_unhealthy', 'sms:provider_status',
    // Email
    'email:sent', 'email:failed', 'email:batch_queued', 'email:message_failed',
    'email:opened', 'email:clicked', 'email:provider_unhealthy', 'email:provider_status',
    // Telegram
    'telegram:sent', 'telegram:failed', 'telegram:batch_queued', 'telegram:message_failed',
    'telegram:provider_unhealthy', 'telegram:provider_status', 'telegram:retry_scheduled',
    // Messenger
    'messenger:sent', 'messenger:failed', 'messenger:batch_queued', 'messenger:message_failed',
    'messenger:provider_unhealthy', 'messenger:provider_status', 'messenger:retry_scheduled',
    // Campaigns
    'campaign:completed', 'campaign:paused', 'campaign:resumed',
    // Inbox
    'inbox:new_message', 'inbox:thread_read', 'inbox:reply_sent', 'inbox:reply_failed',
    'inbox:assigned', 'inbox:status_updated',
    // Leads
    'lead:updated', 'lead:tagged', 'lead:segmented',
    // Automation
    'automation:rule_fired', 'automation:escalation', 'automation:notification',
    'automation:scheduled_campaign_start',
    // Products
    'product:event', 'product:notification',
    'funnel:lead_captured', 'funnel:lead_hot',
    'appointment:booking_created', 'appointment:reminder_sent',
    'payment:received', 'payment:escalated',
    'review:rating_submitted', 'review:negative_review',
    'event:registration_created', 'event:reminder_sent', 'event:event_completed',
    'catalog:order_created', 'catalog:payment_received', 'catalog:order_status_updated',
    'survey:response_completed', 'survey:negative_response',
    'membership:membership_created', 'membership:membership_renewed',
    'membership:membership_expired', 'membership:payment_received',
    // Instagram
    'instagram:dm_received', 'instagram:comment_received', 'instagram:hot_lead',
    'instagram:content_published', 'instagram:content_scheduled',
    // Growth
    'growth:lead_captured', 'growth:missed_call', 'growth:referral_created',
    'growth:deal_created', 'growth:deal_won', 'growth:ad_conversion',
    'growth:negative_review', 'growth:website_lead', 'growth:notification',
    // WA SaaS
    'wa_saas:drip_enrolled', 'wa_saas:human_takeover', 'wa_saas:order_created',
    'wa_saas:order_status', 'wa_saas:subscription_created', 'wa_saas:payment_received',
    'wa_saas:conversation_assigned', 'wa_saas:card_lead', 'wa_saas:notification',
    // QR Payments
    'qr_payment:submitted', 'qr_payment:approved', 'qr_payment:rejected',
    // WA Chat
    'wa_chat:new_message', 'wa_chat:message_sent', 'wa_chat:status_update', 'wa_chat:read',
    // Bot Manager
    'bot:message_sent', 'bot:human_handoff', 'bot:trigger_matched', 'bot:action_executed',
  ];

  const subscriber = redisSub.duplicate();
  channels.forEach((ch) => subscriber.subscribe(ch));
  subscriber.on('message', (channel: string, message: string) => {
    try {
      const data = JSON.parse(message);
      broadcast(channel, data);
    } catch {
      broadcast(channel, { raw: message });
    }
  });
  subscriber.on('error', (err: Error) => {
    log.error(`Redis subscriber error: ${err.message}`);
  });

  log.info(`Subscribed to ${channels.length} Redis channels`);
}

// ── Middleware ─────────────────────────────────────────────────────
app.use(helmet());
app.use(compression());

const allowedOrigins = config.frontendUrl.split(',').map(o => o.trim());
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) callback(null, true);
    else callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
const globalRateLimit = config.nodeEnv === 'production' ? 100 : 500;
app.use(rateLimiter(globalRateLimit, 60));

// ── Request Logging ───────────────────────────────────────────────
app.use((req, res, next) => {
  const requestId = crypto.randomUUID();
  (req as any).requestId = requestId;
  res.setHeader('X-Request-Id', requestId);
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    if (req.path !== '/health') {
      log.info(`${req.method} ${req.path} ${res.statusCode} ${duration}ms`, {
        requestId, ip: req.ip, userAgent: req.headers['user-agent'],
      });
    }
  });
  next();
});

// ── Health ────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    redis: isRedisAvailable(),
    wsClients: clients.size,
  });
});

// ══════════════════════════════════════════════════════════════════
// MODULE ROUTES — Each module owns its own route prefix
// ══════════════════════════════════════════════════════════════════

// Billing & Shopify (raw body needed — registered before express.json)
app.use('/api/billing', billingRoutes);
app.use('/api/shopify', shopifyRoutes);

// ── Channels ──────────────────────────────────────────────────────
app.use('/api/whatsapp', whatsappRoutes);
app.use('/api/sms', smsRoutes);
app.use('/api/email', emailRoutes);
app.use('/api/telegram', telegramRoutes);
app.use('/api/messenger', messengerRoutes);
app.use('/api/instagram', instagramRoutes);

// ── Core ──────────────────────────────────────────────────────────
app.use('/api/campaigns', campaignRoutes);
app.use('/api/templates', templateRoutes);
app.use('/api/inbox', inboxRoutes);
app.use('/api/leads', leadsRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/automation', automationRoutes);
app.use('/api/bots', botRoutes);

// ── Users & Auth ──────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/tenants', tenantRoutes);

// ── Products Suite ────────────────────────────────────────────────
app.use('/api/funnel', funnelRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/payment-bot', paymentBotRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/products', productDashboardRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/catalog', catalogRoutes);
app.use('/api/surveys', surveyRoutes);
app.use('/api/memberships', membershipRoutes);

// ── Growth & SaaS ─────────────────────────────────────────────────
app.use('/api/growth', growthRoutes);
app.use('/api/wa-saas', waSaasRoutes);
app.use('/api/whatsapp-saas', waSaasRoutes);       // alias
app.use('/api/whatsapp/saas', waSaasRoutes);        // alias
app.use('/api/wa-chat', waChatRoutes);

// ── Payments ──────────────────────────────────────────────────────
app.use('/api/qr-payment', qrPaymentRoutes);

// ── Public webhooks ───────────────────────────────────────────────
app.get('/webhook/whatsapp', AdminController.verifyWebhookChallenge);

// ── 404 / Error handlers ─────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  log.error(`Unhandled: ${err.message}`, err);
  res.status(500).json({ error: 'Internal server error' });
});

// ── Global Error Handlers ─────────────────────────────────────────
process.on('unhandledRejection', (reason: Error | string) => {
  log.error(`Unhandled Promise Rejection: ${reason}`);
});

process.on('uncaughtException', (err: Error) => {
  log.error(`Uncaught Exception: ${err.message}`, err);
  process.exit(1);
});

// ── Graceful Shutdown ─────────────────────────────────────────────
let isShuttingDown = false;

async function gracefulShutdown(signal: string) {
  if (isShuttingDown) return;
  isShuttingDown = true;
  log.info(`Received ${signal}. Starting graceful shutdown...`);

  server.close(() => { log.info('HTTP server closed'); });
  for (const ws of clients) ws.close();
  clients.clear();

  try { await pool.end(); log.info('Database pool closed'); } catch (err) { log.error('Error closing database pool', err); }
  try { if (isRedisAvailable()) { redisSub.quit(); log.info('Redis connection closed'); } } catch (err) { log.error('Error closing Redis', err); }

  log.info('Graceful shutdown complete');
  process.exit(0);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// ── Start ─────────────────────────────────────────────────────────
async function start() {
  await connectRedis();
  const dbReady = await connectDb();
  if (!dbReady) {
    log.error('Database is required for API operations. Start PostgreSQL and restart the backend.');
    process.exit(1);
  }

  // Run all module migrations
  const migrations = [
    ['core', migrate],
    ['saas', saasMigrate],
    ['products', productsMigrate],
    ['products-v2', productsMigrateV2],
    ['instagram', instagramMigrate],
    ['growth', growthMigrate],
    ['wa-saas', waSaasMigrate],
    ['qr-payment', qrPaymentMigrate],
    ['telegram', telegramMigrate],
    ['messenger', messengerMigrate],
    ['tenant-isolation', tenantIsolationMigrate],
    ['sms', smsMigrate],
    ['wa-chat', waChatMigrate],
    ['leads-v2', leadsMigrateV2],
    ['bot-manager', runBotMigration],
  ] as const;

  for (const [name, fn] of migrations) {
    try { await fn(); } catch (e) { log.warn(`${name} migration failed: ${(e as Error).message}`); }
  }

  setupRedisBroadcast();

  server.on('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'EADDRINUSE') {
      log.error(`Port ${config.port} already in use.`);
      process.exit(1);
    }
    throw err;
  });

  server.listen(config.port, () => {
    log.info(`Server running on port ${config.port} (${config.nodeEnv})`);
    log.info(`WebSocket endpoint: ws://localhost:${config.port}/ws`);
  });
}

start();

export { app, server, broadcast };
export default app;
