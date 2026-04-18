/**
 * Webhook signature verification middleware.
 * Validates HMAC signatures for incoming webhooks from external services.
 */
import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { config } from '../../config/src/config';
import { createLogger } from './logger';

const log = createLogger('webhook-verify');

/**
 * Verify Meta (Instagram / Facebook) webhook signature.
 * Meta sends X-Hub-Signature-256 header with SHA-256 HMAC of the request body.
 */
export function verifyMetaWebhookSignature(req: Request, res: Response, next: NextFunction): void {
  const secret = config.instagram?.appSecret || config.messenger?.appSecret;
  if (!secret) {
    // If no secret is configured, skip verification (dev mode)
    log.warn('No Meta app secret configured — skipping webhook signature verification');
    next();
    return;
  }

  const signature = req.headers['x-hub-signature-256'] as string | undefined;
  if (!signature) {
    log.warn('Meta webhook received without X-Hub-Signature-256 header');
    res.status(401).json({ error: 'Missing signature' });
    return;
  }

  const rawBody = JSON.stringify(req.body);
  const expected = 'sha256=' + crypto
    .createHmac('sha256', secret)
    .update(rawBody)
    .digest('hex');

  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
    log.warn('Meta webhook signature mismatch');
    res.status(403).json({ error: 'Invalid signature' });
    return;
  }

  next();
}

/**
 * Verify Telegram webhook by checking the secret_token header.
 */
export function verifyTelegramWebhookSecret(req: Request, res: Response, next: NextFunction): void {
  const secret = config.telegram?.webhookSecret;
  if (!secret) {
    next();
    return;
  }

  const token = req.headers['x-telegram-bot-api-secret-token'] as string | undefined;
  if (!token || token !== secret) {
    log.warn('Telegram webhook secret mismatch');
    res.status(403).json({ error: 'Invalid webhook secret' });
    return;
  }

  next();
}
