import { Request, Response } from 'express';
import { MessengerService } from './messenger.service';
import { InboxService } from '../../../modules/inbox/backend/inbox.service';
import { MessengerBatchSchema } from './MessengerMessage';
import { config } from '../../../packages/config/src/config';
import { z } from 'zod';
import { createLogger } from '../../../packages/utils/src/logger';
import crypto from 'crypto';

const log = createLogger('ctrl:messenger');

export class MessengerController {
  /** Send a batch of messages */
  static async sendBatch(req: Request, res: Response) {
    try {
      const data = MessengerBatchSchema.parse(req.body);
      const result = await MessengerService.queueBatch(
        data.campaign_id, data.contacts, data.message,
        data.message_type, data.image_url, data.buttons,
        data.quick_replies, data.tag,
        data.provider_chain, data.priority
      );
      res.json({ success: true, ...result });
    } catch (err) {
      if (err instanceof z.ZodError) {
        res.status(400).json({ error: 'Validation failed', details: err.errors });
        return;
      }
      log.error('sendBatch failed', err);
      res.status(500).json({ error: 'Failed to queue messages' });
    }
  }

  static async getCampaignStats(req: Request, res: Response) {
    try {
      const stats = await MessengerService.getCampaignStats(req.params.id);
      res.json({ success: true, stats });
    } catch (err) {
      log.error('getCampaignStats failed', err);
      res.status(500).json({ error: 'Failed to get stats' });
    }
  }

  static async getDailyStats(req: Request, res: Response) {
    try {
      const days = parseInt(req.query.days as string) || 7;
      res.json({ success: true, stats: await MessengerService.getDailyStats(days) });
    } catch (err) {
      log.error('getDailyStats failed', err);
      res.status(500).json({ error: 'Failed to get daily stats' });
    }
  }

  static async getProviderStats(_req: Request, res: Response) {
    try {
      res.json({ success: true, stats: await MessengerService.getProviderStats() });
    } catch (err) {
      log.error('getProviderStats failed', err);
      res.status(500).json({ error: 'Failed to get provider stats' });
    }
  }

  static async retryFailed(req: Request, res: Response) {
    try {
      const count = await MessengerService.retryFailed(req.params.id);
      res.json({ success: true, retried: count });
    } catch (err) {
      log.error('retryFailed failed', err);
      res.status(500).json({ error: 'Failed to retry messages' });
    }
  }

  /** Facebook Messenger webhook verification (GET) */
  static async verifyWebhook(req: Request, res: Response) {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode === 'subscribe' && token === config.messenger.verifyToken) {
      log.info('Messenger webhook verified');
      res.status(200).send(challenge);
    } else {
      log.warn('Messenger webhook verification failed');
      res.sendStatus(403);
    }
  }

  /** Facebook Messenger webhook (POST) — incoming messages, postbacks, delivery, read */
  static async receiveWebhook(req: Request, res: Response) {
    try {
      // Verify signature if appSecret is configured
      const appSecret = config.messenger.appSecret;
      if (appSecret) {
        const signature = req.headers['x-hub-signature-256'] as string;
        if (!signature) {
          res.sendStatus(403);
          return;
        }
        const expectedSig = 'sha256=' + crypto
          .createHmac('sha256', appSecret)
          .update(JSON.stringify(req.body))
          .digest('hex');
        if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSig))) {
          log.warn('Messenger webhook signature mismatch');
          res.sendStatus(403);
          return;
        }
      }

      const body = req.body;
      if (body.object !== 'page') {
        res.sendStatus(404);
        return;
      }

      for (const entry of body.entry || []) {
        for (const event of entry.messaging || []) {
          const senderId = String(event.sender?.id || '');
          const recipientId = String(event.recipient?.id || '');

          // ── Incoming message ──
          if (event.message && !event.message.is_echo) {
            const text = event.message.text || '';
            const attachments = event.message.attachments || [];
            const msgBody = text || (attachments.length > 0
              ? `[${attachments[0].type || 'attachment'}]`
              : '[empty message]');

            if (senderId) {
              await InboxService.receiveIncoming({
                channel: 'messenger',
                sender: senderId,
                recipient: recipientId,
                body: msgBody,
                provider: 'fb_page',
                external_message_id: event.message.mid || undefined,
                metadata: {
                  has_attachments: attachments.length > 0,
                  attachment_types: attachments.map((a: Record<string, unknown>) => a.type),
                  quick_reply_payload: event.message.quick_reply?.payload,
                  nlp: event.message.nlp,
                },
              });
            }
          }

          // ── Postback (button click) ──
          if (event.postback) {
            if (senderId) {
              await InboxService.receiveIncoming({
                channel: 'messenger',
                sender: senderId,
                recipient: recipientId,
                body: `[Postback: ${event.postback.title || event.postback.payload || 'action'}]`,
                provider: 'fb_page',
                metadata: {
                  postback_title: event.postback.title,
                  postback_payload: event.postback.payload,
                  referral: event.postback.referral,
                },
              });
            }
          }

          // ── Delivery confirmation ──
          if (event.delivery) {
            const mids = event.delivery.mids || [];
            for (const mid of mids) {
              await InboxService.updateDeliveryStatus('messenger', mid, 'delivered').catch(() => {});
            }
          }

          // ── Read confirmation ──
          if (event.read) {
            // Facebook sends read.watermark timestamp, not individual mids
            // We can optionally mark recent messages as read
          }

          // ── Messaging opt-in ──
          if (event.optin) {
            if (senderId) {
              await InboxService.receiveIncoming({
                channel: 'messenger',
                sender: senderId,
                body: `[Opt-in: ${event.optin.ref || event.optin.payload || 'subscribed'}]`,
                provider: 'fb_page',
                metadata: { optin_ref: event.optin.ref, optin_payload: event.optin.payload },
              });
            }
          }

          // ── Referral (m.me link, ad, etc.) ──
          if (event.referral) {
            if (senderId) {
              await InboxService.receiveIncoming({
                channel: 'messenger',
                sender: senderId,
                body: `[Referral: ${event.referral.ref || event.referral.source || 'unknown'}]`,
                provider: 'fb_page',
                metadata: {
                  referral_ref: event.referral.ref,
                  referral_source: event.referral.source,
                  referral_type: event.referral.type,
                  referral_ad_id: event.referral.ad_id,
                },
              });
            }
          }
        }
      }

      // Facebook requires 200 within 20 seconds
      res.sendStatus(200);
    } catch (err) {
      log.error('receiveWebhook failed', err);
      res.sendStatus(200); // Always 200 to prevent Facebook retries on our errors
    }
  }

  /** Validate a page access token */
  static async validatePage(req: Request, res: Response) {
    try {
      const { page_access_token } = req.body;
      if (!page_access_token || typeof page_access_token !== 'string') {
        res.status(400).json({ error: 'page_access_token is required' });
        return;
      }
      const info = await MessengerService.getPageInfo(page_access_token);
      res.json({ success: info.ok, ...info });
    } catch (err) {
      log.error('validatePage failed', err);
      res.status(500).json({ error: 'Failed to validate page' });
    }
  }

  /** Subscribe app to page events */
  static async subscribeApp(req: Request, res: Response) {
    try {
      const { page_access_token } = req.body;
      if (!page_access_token || typeof page_access_token !== 'string') {
        res.status(400).json({ error: 'page_access_token is required' });
        return;
      }
      const result = await MessengerService.subscribeApp(page_access_token);
      res.json({ success: result.ok, ...result });
    } catch (err) {
      log.error('subscribeApp failed', err);
      res.status(500).json({ error: 'Failed to subscribe app' });
    }
  }
}
