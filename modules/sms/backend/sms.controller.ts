import { Request, Response } from 'express';
import { SMSService } from './sms.service';
import { InboxService } from '../../../modules/inbox/backend/inbox.service';
import { SMSBatchSchema } from './SMSMessage';
import { z } from 'zod';
import { createLogger } from '../../../packages/utils/src/logger';

const log = createLogger('ctrl:sms');

interface AuthRequest extends Request {
  tenantId?: string;
}

export class SMSController {
  static async sendBatch(req: AuthRequest, res: Response) {
    try {
      const data = SMSBatchSchema.parse(req.body);
      const result = await SMSService.queueBatch(
        data.campaign_id, data.contacts, data.message,
        data.sender_id, data.dlt_template_id, data.provider_chain, data.priority,
        data.use_dlt, data.virtual_number_id, req.tenantId
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
      res.json({ success: true, stats: await SMSService.getCampaignStats(req.params.id) });
    } catch (err) {
      log.error('getCampaignStats failed', err);
      res.status(500).json({ error: 'Failed to get stats' });
    }
  }

  static async getDailyStats(req: Request, res: Response) {
    try {
      const days = parseInt(req.query.days as string) || 7;
      res.json({ success: true, stats: await SMSService.getDailyStats(days) });
    } catch (err) {
      log.error('getDailyStats failed', err);
      res.status(500).json({ error: 'Failed to get daily stats' });
    }
  }

  static async getProviderStats(_req: Request, res: Response) {
    try {
      res.json({ success: true, stats: await SMSService.getProviderStats() });
    } catch (err) {
      log.error('getProviderStats failed', err);
      res.status(500).json({ error: 'Failed to get provider stats' });
    }
  }

  static async retryFailed(req: Request, res: Response) {
    try {
      const count = await SMSService.retryFailed(req.params.id);
      res.json({ success: true, retried: count });
    } catch (err) {
      log.error('retryFailed failed', err);
      res.status(500).json({ error: 'Failed to retry messages' });
    }
  }

  /** Generic inbound SMS webhook – accepts various provider payload shapes */
  static async receiveInboundWebhook(req: Request, res: Response) {
    try {
      const sender = String(req.body?.from || req.body?.sender || req.body?.msisdn || req.body?.mobile || req.body?.phone || '');
      const body = String(req.body?.message || req.body?.text || req.body?.body || req.body?.content || '');
      if (!sender || !body) { res.status(400).json({ error: 'from and message are required' }); return; }
      const result = await InboxService.receiveIncoming({
        channel: 'sms', sender, body,
        recipient: req.body?.to ? String(req.body.to) : undefined,
        provider: req.body?.provider ? String(req.body.provider) : undefined,
        external_message_id: req.body?.messageId ? String(req.body.messageId) : req.body?.message_id ? String(req.body.message_id) : undefined,
        lead_name: req.body?.name ? String(req.body.name) : undefined,
        metadata: { contact_name: req.body?.name, raw: req.body },
      });
      res.status(202).json({ success: true, ...result });
    } catch (err) {
      log.error('receiveInboundWebhook failed', err);
      res.status(500).json({ error: 'Failed to process inbound SMS' });
    }
  }

  static async receiveStatusWebhook(req: Request, res: Response) {
    try {
      // Twilio status callback
      if (req.body?.MessageSid && req.body?.MessageStatus) {
        const extId = String(req.body.MessageSid);
        const raw = String(req.body.MessageStatus).toLowerCase();
        const mapped = raw === 'delivered' ? 'delivered' as const : raw === 'sent' ? 'sent' as const : raw === 'read' ? 'read' as const : raw === 'undelivered' || raw === 'failed' ? 'failed' as const : 'sent' as const;
        const result = await InboxService.updateDeliveryStatus('sms', extId, mapped, req.body?.ErrorMessage ? String(req.body.ErrorMessage) : undefined);
        res.json({ success: true, ...result });
        return;
      }

      // AWS SNS notification (delivery status)
      if (req.body?.Type === 'Notification' && req.body?.Message) {
        try {
          const snsMsg = JSON.parse(req.body.Message);
          if (snsMsg.delivery?.phoneCarrier) {
            const extId = String(snsMsg.notification?.messageId || '');
            const status = snsMsg.status === 'SUCCESS' ? 'delivered' as const : 'failed' as const;
            if (extId) {
              const result = await InboxService.updateDeliveryStatus('sms', extId, status);
              res.json({ success: true, ...result });
              return;
            }
          }
        } catch { /* not SNS JSON, fall through */ }
      }

      // Generic status webhook
      const extId = String(req.body?.messageId || req.body?.message_id || req.body?.id || '');
      if (!extId) { res.status(400).json({ error: 'messageId required' }); return; }
      const raw = String(req.body?.status || req.body?.delivery_status || req.body?.event || '').toLowerCase();
      const mapped = raw === 'delivered' ? 'delivered' as const : raw === 'sent' || raw === 'submitted' ? 'sent' as const : raw === 'read' ? 'read' as const : 'failed' as const;
      const result = await InboxService.updateDeliveryStatus('sms', extId, mapped, req.body?.error ? String(req.body.error) : undefined);
      res.json({ success: true, ...result });
    } catch (err) {
      log.error('receiveStatusWebhook failed', err);
      res.status(500).json({ error: 'Failed to process SMS status webhook' });
    }
  }
}
