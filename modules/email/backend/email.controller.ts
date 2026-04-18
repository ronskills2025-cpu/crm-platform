import { Request, Response } from 'express';
import { EmailService } from './email.service';
import { InboxService } from '../../../modules/inbox/backend/inbox.service';
import { EmailBatchSchema } from './EmailMessage';
import { query } from '../../../packages/db/src/connection';
import { publishEvent } from '../../../packages/db/src/redis';
import { z } from 'zod';
import { createLogger } from '../../../packages/utils/src/logger';

const log = createLogger('ctrl:email');

function extractEmail(v: unknown): string | undefined {
  if (!v) return undefined;
  if (typeof v === 'string') { const m = v.match(/<([^>]+)>/); return (m?.[1] || v).trim().toLowerCase(); }
  if (typeof v === 'object' && v !== null && 'email' in v) return String((v as { email: string }).email).toLowerCase();
  if (Array.isArray(v) && v.length) return extractEmail(v[0]);
  return undefined;
}

export class EmailController {
  static async sendBatch(req: Request, res: Response) {
    try {
      const data = EmailBatchSchema.parse(req.body);
      const result = await EmailService.queueBatch(
        data.campaign_id, data.contacts, data.subject,
        data.html_body, data.text_body, data.provider_chain, data.priority
      );
      res.json({ success: true, ...result });
    } catch (err) {
      if (err instanceof z.ZodError) { res.status(400).json({ error: 'Validation failed', details: err.errors }); return; }
      log.error('sendBatch failed', err);
      res.status(500).json({ error: 'Failed to queue messages' });
    }
  }

  static async getCampaignStats(req: Request, res: Response) {
    try {
      res.json({ success: true, stats: await EmailService.getCampaignStats(req.params.id) });
    } catch (err) {
      log.error('getCampaignStats failed', err);
      res.status(500).json({ error: 'Failed to get stats' });
    }
  }

  static async getDailyStats(req: Request, res: Response) {
    try {
      const days = parseInt(req.query.days as string) || 7;
      res.json({ success: true, stats: await EmailService.getDailyStats(days) });
    } catch (err) {
      log.error('getDailyStats failed', err);
      res.status(500).json({ error: 'Failed to get daily stats' });
    }
  }

  static async getProviderStats(_req: Request, res: Response) {
    try {
      res.json({ success: true, stats: await EmailService.getProviderStats() });
    } catch (err) {
      log.error('getProviderStats failed', err);
      res.status(500).json({ error: 'Failed to get provider stats' });
    }
  }

  static async retryFailed(req: Request, res: Response) {
    try {
      const count = await EmailService.retryFailed(req.params.id);
      res.json({ success: true, retried: count });
    } catch (err) {
      log.error('retryFailed failed', err);
      res.status(500).json({ error: 'Failed to retry messages' });
    }
  }

  static async trackOpen(req: Request, res: Response) {
    try {
      const id = req.params.id;
      await query(
        `UPDATE email_messages
         SET status = CASE WHEN status = 'clicked' THEN status ELSE 'opened' END,
             opened_at = COALESCE(opened_at, NOW())
         WHERE id = $1`,
        [id]
      );
      publishEvent('email:opened', { id });

      const pixel = Buffer.from(
        'R0lGODlhAQABAPAAAAAAAAAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==',
        'base64'
      );
      res.setHeader('Content-Type', 'image/gif');
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.end(pixel);
    } catch (err) {
      log.error('trackOpen failed', err);
      res.status(500).end();
    }
  }

  static async trackClick(req: Request, res: Response) {
    try {
      const id = req.params.id;
      const url = typeof req.query.url === 'string' ? req.query.url : undefined;
      await query(
        `UPDATE email_messages
         SET status = 'clicked', clicked_at = COALESCE(clicked_at, NOW())
         WHERE id = $1`,
        [id]
      );
      publishEvent('email:clicked', { id, url });

      if (url) {
        res.redirect(url);
        return;
      }

      res.json({ success: true, tracked: true });
    } catch (err) {
      log.error('trackClick failed', err);
      res.status(500).json({ error: 'Failed to track click' });
    }
  }

  /** Inbound email webhook (SendGrid Inbound Parse, Resend, Mailgun, etc.) */
  static async receiveInboundWebhook(req: Request, res: Response) {
    try {
      const sender = extractEmail(req.body?.from || req.body?.sender || req.body?.headers?.from);
      const recipient = extractEmail(req.body?.to || req.body?.recipient || req.body?.headers?.to);
      const subject = typeof req.body?.subject === 'string' ? req.body.subject : 'Inbound Email';
      const body = String(req.body?.text || req.body?.text_body || req.body?.['body-plain'] || req.body?.html || req.body?.body || '').trim();
      if (!sender || !body) { res.status(400).json({ error: 'from and body are required' }); return; }
      const result = await InboxService.receiveIncoming({
        channel: 'email', sender, recipient, subject, body,
        provider: req.body?.provider ? String(req.body.provider) : undefined,
        external_message_id: req.body?.messageId ? String(req.body.messageId) : req.body?.message_id ? String(req.body.message_id) : req.body?.headers?.['message-id'] ? String(req.body.headers['message-id']) : undefined,
        lead_name: req.body?.name ? String(req.body.name) : undefined,
        metadata: { contact_name: req.body?.name, raw: req.body },
      });
      res.status(202).json({ success: true, ...result });
    } catch (err) {
      log.error('receiveInboundWebhook failed', err);
      res.status(500).json({ error: 'Failed to process inbound email' });
    }
  }

  /** Delivery status webhook (SendGrid Events, Resend, Mailgun, etc.) */
  static async receiveStatusWebhook(req: Request, res: Response) {
    try {
      const extId = String(req.body?.messageId || req.body?.message_id || req.body?.id || req.body?.sg_message_id || '');
      if (!extId) { res.status(400).json({ error: 'messageId required' }); return; }
      const raw = String(req.body?.status || req.body?.event || req.body?.type || '').toLowerCase();
      const mapped = raw === 'opened' || raw === 'open' || raw === 'read' ? 'read' as const
        : raw === 'delivered' || raw === 'processed' ? 'delivered' as const
        : raw === 'sent' || raw === 'queued' ? 'sent' as const : 'failed' as const;
      const error = req.body?.reason ? String(req.body.reason) : req.body?.error ? String(req.body.error) : undefined;
      const result = await InboxService.updateDeliveryStatus('email', extId, mapped, error);
      if (raw === 'opened') publishEvent('email:opened', { external_message_id: extId });
      if (raw === 'clicked') publishEvent('email:clicked', { external_message_id: extId, url: req.body?.url || null });
      res.json({ success: true, ...result });
    } catch (err) {
      log.error('receiveStatusWebhook failed', err);
      res.status(500).json({ error: 'Failed to process email status webhook' });
    }
  }
}
