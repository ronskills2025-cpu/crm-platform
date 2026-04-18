import { Request, Response } from 'express';
import { WhatsAppService } from './whatsapp.service';
import { InboxService } from '../../../modules/inbox/backend/inbox.service';
import { WhatsAppBatchSchema } from './WhatsAppMessage';
import { config } from '../../../packages/config/src/config';
import { z } from 'zod';
import { createLogger } from '../../../packages/utils/src/logger';

const log = createLogger('ctrl:whatsapp');

function extractWhatsAppBody(message: Record<string, unknown>): string {
  const text = message?.text as Record<string, unknown> | undefined;
  if (typeof text?.body === 'string') return text.body;
  const button = message?.button as Record<string, unknown> | undefined;
  if (typeof button?.text === 'string') return button.text;
  return `[${(message?.type as string) || 'message'}]`;
}

export class WhatsAppController {
  static async sendBatch(req: Request, res: Response) {
    try {
      const data = WhatsAppBatchSchema.parse(req.body);
      const result = await WhatsAppService.queueBatch(
        data.campaign_id, data.contacts, data.message,
        data.template_id, data.provider_chain, data.priority
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
      const stats = await WhatsAppService.getCampaignStats(req.params.id);
      res.json({ success: true, stats });
    } catch (err) {
      log.error('getCampaignStats failed', err);
      res.status(500).json({ error: 'Failed to get stats' });
    }
  }

  static async getDailyStats(req: Request, res: Response) {
    try {
      const days = parseInt(req.query.days as string) || 7;
      res.json({ success: true, stats: await WhatsAppService.getDailyStats(days) });
    } catch (err) {
      log.error('getDailyStats failed', err);
      res.status(500).json({ error: 'Failed to get daily stats' });
    }
  }

  static async getProviderStats(_req: Request, res: Response) {
    try {
      res.json({ success: true, stats: await WhatsAppService.getProviderStats() });
    } catch (err) {
      log.error('getProviderStats failed', err);
      res.status(500).json({ error: 'Failed to get provider stats' });
    }
  }

  static async retryFailed(req: Request, res: Response) {
    try {
      const count = await WhatsAppService.retryFailed(req.params.id);
      res.json({ success: true, retried: count });
    } catch (err) {
      log.error('retryFailed failed', err);
      res.status(500).json({ error: 'Failed to retry messages' });
    }
  }

  /** Meta Cloud API – Webhook verification (GET) */
  static async verifyWebhook(req: Request, res: Response) {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];
    if (mode === 'subscribe' && token === config.whatsapp.verifyToken) {
      res.status(200).send(String(challenge || 'ok'));
      return;
    }
    res.status(403).json({ error: 'Invalid verify token' });
  }

  /** Meta Cloud API – Incoming messages + delivery statuses (POST) */
  static async receiveWebhook(req: Request, res: Response) {
    try {
      const entries: unknown[] = Array.isArray(req.body?.entry) ? req.body.entry : [];
      for (const entry of entries as Record<string, unknown>[]) {
        const changes: unknown[] = Array.isArray(entry?.changes) ? entry.changes as unknown[] : [];
        for (const change of changes as Record<string, unknown>[]) {
          const value = (change?.value ?? {}) as Record<string, unknown>;
          const contacts = Array.isArray(value.contacts) ? value.contacts as Record<string, unknown>[] : [];
          const contactNames = new Map<string, string>();
          for (const c of contacts) {
            if (c?.wa_id) contactNames.set(String(c.wa_id), String((c.profile as Record<string, unknown>)?.name || ''));
          }

          // Incoming messages
          const messages = Array.isArray(value.messages) ? value.messages as Record<string, unknown>[] : [];
          for (const msg of messages) {
            const sender = msg?.from ? String(msg.from) : '';
            if (!sender) continue;
            await InboxService.receiveIncoming({
              channel: 'whatsapp',
              sender,
              recipient: value?.metadata ? String((value.metadata as Record<string, unknown>).display_phone_number || '') : undefined,
              body: extractWhatsAppBody(msg),
              provider: 'meta',
              external_message_id: msg?.id ? String(msg.id) : undefined,
              lead_name: contactNames.get(sender) || undefined,
              metadata: { contact_name: contactNames.get(sender), type: msg?.type || 'text' },
            });
          }

          // Delivery statuses
          const statuses = Array.isArray(value.statuses) ? value.statuses as Record<string, unknown>[] : [];
          for (const st of statuses) {
            const extId = st?.id ? String(st.id) : '';
            if (!extId) continue;
            const raw = String(st?.status || '').toLowerCase();
            const mapped = raw === 'read' ? 'read' as const : raw === 'delivered' ? 'delivered' as const : raw === 'sent' ? 'sent' as const : 'failed' as const;
            const errors = Array.isArray(st?.errors) ? (st.errors as Record<string, string>[]).map(e => e?.title || e?.message).filter(Boolean).join('; ') : undefined;
            await InboxService.updateDeliveryStatus('whatsapp', extId, mapped, errors);
          }
        }
      }
      res.sendStatus(200);
    } catch (err) {
      log.error('receiveWebhook failed', err);
      res.status(500).json({ error: 'Webhook processing failed' });
    }
  }
}
