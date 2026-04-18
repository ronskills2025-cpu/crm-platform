import { Request, Response } from 'express';
import { TelegramService } from './telegram.service';
import { InboxService } from '../../../modules/inbox/backend/inbox.service';
import { TelegramBatchSchema } from './TelegramMessage';
import { config } from '../../../packages/config/src/config';
import { z } from 'zod';
import { createLogger } from '../../../packages/utils/src/logger';
import crypto from 'crypto';

const log = createLogger('ctrl:telegram');

export class TelegramController {
  static async sendBatch(req: Request, res: Response) {
    try {
      const data = TelegramBatchSchema.parse(req.body);
      const result = await TelegramService.queueBatch(
        data.campaign_id, data.contacts, data.message,
        data.parse_mode, data.photo_url, data.reply_markup,
        data.provider_chain, data.priority
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
      const stats = await TelegramService.getCampaignStats(req.params.id);
      res.json({ success: true, stats });
    } catch (err) {
      log.error('getCampaignStats failed', err);
      res.status(500).json({ error: 'Failed to get stats' });
    }
  }

  static async getDailyStats(req: Request, res: Response) {
    try {
      const days = parseInt(req.query.days as string) || 7;
      res.json({ success: true, stats: await TelegramService.getDailyStats(days) });
    } catch (err) {
      log.error('getDailyStats failed', err);
      res.status(500).json({ error: 'Failed to get daily stats' });
    }
  }

  static async getProviderStats(_req: Request, res: Response) {
    try {
      res.json({ success: true, stats: await TelegramService.getProviderStats() });
    } catch (err) {
      log.error('getProviderStats failed', err);
      res.status(500).json({ error: 'Failed to get provider stats' });
    }
  }

  static async retryFailed(req: Request, res: Response) {
    try {
      const count = await TelegramService.retryFailed(req.params.id);
      res.json({ success: true, retried: count });
    } catch (err) {
      log.error('retryFailed failed', err);
      res.status(500).json({ error: 'Failed to retry messages' });
    }
  }

  /** Telegram Bot API – Incoming webhook (POST) */
  static async receiveWebhook(req: Request, res: Response) {
    try {
      // Verify secret token header if configured
      const secretToken = config.telegram.webhookSecret;
      if (secretToken) {
        const headerSecret = req.headers['x-telegram-bot-api-secret-token'];
        if (headerSecret !== secretToken) {
          res.status(403).json({ error: 'Invalid secret token' });
          return;
        }
      }

      const update = req.body;

      // Handle incoming messages
      if (update?.message) {
        const msg = update.message;
        const chatId = String(msg.chat?.id || '');
        const sender = chatId;
        const senderName = [msg.from?.first_name, msg.from?.last_name].filter(Boolean).join(' ') || msg.from?.username || '';
        const body = msg.text || msg.caption || `[${msg.photo ? 'photo' : msg.document ? 'document' : msg.sticker ? 'sticker' : 'message'}]`;

        if (sender) {
          await InboxService.receiveIncoming({
            channel: 'telegram',
            sender,
            recipient: msg.chat?.username ? `@${msg.chat.username}` : undefined,
            body,
            provider: 'telegram_bot',
            external_message_id: msg.message_id ? String(msg.message_id) : undefined,
            lead_name: senderName || undefined,
            metadata: {
              chat_type: msg.chat?.type,
              from_username: msg.from?.username,
              from_id: msg.from?.id,
              has_photo: !!msg.photo,
              has_document: !!msg.document,
            },
          });
        }
      }

      // Handle callback queries (inline keyboard button presses)
      if (update?.callback_query) {
        const cb = update.callback_query;
        const chatId = String(cb.message?.chat?.id || '');
        const senderName = [cb.from?.first_name, cb.from?.last_name].filter(Boolean).join(' ') || '';

        if (chatId) {
          await InboxService.receiveIncoming({
            channel: 'telegram',
            sender: chatId,
            body: `[Button: ${cb.data || 'callback'}]`,
            provider: 'telegram_bot',
            external_message_id: cb.id ? String(cb.id) : undefined,
            lead_name: senderName || undefined,
            metadata: {
              callback_data: cb.data,
              from_username: cb.from?.username,
              from_id: cb.from?.id,
            },
          });
        }
      }

      // Handle bot blocked/unblocked (my_chat_member updates)
      if (update?.my_chat_member) {
        const member = update.my_chat_member;
        const chatId = String(member.chat?.id || '');
        const newStatus = member.new_chat_member?.status;

        if (chatId && newStatus === 'kicked') {
          // User blocked the bot — mark messages as blocked
          log.info(`Bot blocked by user ${chatId}`);
        }
      }

      res.sendStatus(200);
    } catch (err) {
      log.error('receiveWebhook failed', err);
      res.status(500).json({ error: 'Webhook processing failed' });
    }
  }

  /** Validate a bot token */
  static async validateBot(req: Request, res: Response) {
    try {
      const { bot_token } = req.body;
      if (!bot_token || typeof bot_token !== 'string') {
        res.status(400).json({ error: 'bot_token is required' });
        return;
      }
      const info = await TelegramService.getBotInfo(bot_token);
      res.json({ success: info.ok, ...info });
    } catch (err) {
      log.error('validateBot failed', err);
      res.status(500).json({ error: 'Failed to validate bot' });
    }
  }

  /** Set webhook for a bot */
  static async setupWebhook(req: Request, res: Response) {
    try {
      const { bot_token, webhook_url } = req.body;
      if (!bot_token || !webhook_url) {
        res.status(400).json({ error: 'bot_token and webhook_url are required' });
        return;
      }
      const secretToken = config.telegram.webhookSecret || crypto.randomBytes(32).toString('hex');
      const result = await TelegramService.setWebhook(bot_token, webhook_url, secretToken);
      res.json({ success: result.ok, secret_token: secretToken, ...result });
    } catch (err) {
      log.error('setupWebhook failed', err);
      res.status(500).json({ error: 'Failed to setup webhook' });
    }
  }
}
