import { Request, Response } from 'express';
import { z } from 'zod';
import {
  WaChatCredentialService,
  WaChatContactService,
  WaChatConversationService,
  WaChatMessageService,
  WaChatSendService,
  WaChatWindowService,
} from './wa-chat.service';
import { publishEvent } from '../../../packages/db/src/redis';
import { query } from '../../../packages/db/src/connection';
import { createLogger } from '../../../packages/utils/src/logger';
import { ComplianceService } from '../../compliance/backend/compliance.service';

const log = createLogger('ctrl:wa-chat');

// Get webhook config from database or environment
async function getWebhookConfig() {
  try {
    const result = await query<{ webhook_url: string; verify_token: string }>(
      `SELECT webhook_url, verify_token FROM wa_chat_webhook_config WHERE is_active = true ORDER BY created_at DESC LIMIT 1`
    );
    if (result.rows[0]) {
      return result.rows[0];
    }
  } catch (err) {
    // Table might not exist yet, use defaults
  }
  
  // Fallback to environment or defaults
  return {
    webhook_url: process.env.WA_CHAT_WEBHOOK_URL || 'https://api.msgcrm.com/api/wa-chat/webhook',
    verify_token: process.env.WA_CHAT_VERIFY_TOKEN || 'msgcrm_wa_verify_2024'
  };
}

interface AuthRequest extends Request {
  tenantId?: string;
  userId?: string;
}

// ── Zod Schemas ──────────────────────────────────────────────────

const SaveCredsSchema = z.object({
  phone_number_id: z.string().min(1, 'Phone Number ID required'),
  access_token: z.string().min(1, 'Access Token required'),
  business_account_id: z.string().optional(),
  display_name: z.string().optional(),
});

const SendTextSchema = z.object({
  text: z.string().min(1).max(4096),
});

const SendMediaSchema = z.object({
  type: z.enum(['image', 'document', 'video', 'audio']),
  url: z.string().url(),
  caption: z.string().max(1024).optional(),
  filename: z.string().max(255).optional(),
  mime_type: z.string().max(100).optional(),
});

const ListConversationsSchema = z.object({
  search: z.string().optional(),
  status: z.enum(['active', 'archived', 'closed']).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

const ListMessagesSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  before: z.string().optional(),
});

// ── Webhook Handlers (Public – No Auth) ──────────────────────────

export class WaChatController {
  /** GET /webhook – Meta verification challenge */
  static async verifyWebhook(req: Request, res: Response) {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    const config = await getWebhookConfig();
    if (mode === 'subscribe' && token === config.verify_token) {
      log.info('Webhook verification successful');
      res.status(200).send(String(challenge || 'ok'));
      return;
    }
    log.warn('Webhook verification failed', { mode, token });
    res.status(403).json({ error: 'Invalid verify token' });
  }

  /** POST /webhook – Incoming messages + status updates */
  static async receiveWebhook(req: Request, res: Response) {
    // Acknowledge immediately to prevent Meta retries
    res.sendStatus(200);

    try {
      const entries: unknown[] = Array.isArray(req.body?.entry) ? req.body.entry : [];

      for (const entry of entries as Record<string, unknown>[]) {
        const changes: unknown[] = Array.isArray(entry?.changes) ? entry.changes as unknown[] : [];

        for (const change of changes as Record<string, unknown>[]) {
          const value = (change?.value ?? {}) as Record<string, unknown>;
          const metadata = (value.metadata ?? {}) as Record<string, string>;
          const phoneNumberId = metadata.phone_number_id || '';

          if (!phoneNumberId) continue;

          // Resolve tenant from phone_number_id
          const tenantResult = await query<{ tenant_id: string }>(
            `SELECT tenant_id FROM wa_chat_credentials WHERE phone_number_id = $1 AND is_active = true LIMIT 1`,
            [phoneNumberId]
          );
          const tenantId = tenantResult.rows[0]?.tenant_id;
          if (!tenantId) {
            log.warn('No tenant for phone_number_id', { phoneNumberId });
            continue;
          }

          // Parse contact names
          const contacts = Array.isArray(value.contacts) ? value.contacts as Record<string, unknown>[] : [];
          const contactNames = new Map<string, string>();
          for (const c of contacts) {
            if (c?.wa_id) {
              contactNames.set(String(c.wa_id), String((c.profile as Record<string, unknown>)?.name || ''));
            }
          }

          // ── Incoming Messages ──
          const messages = Array.isArray(value.messages) ? value.messages as Record<string, unknown>[] : [];
          for (const msg of messages) {
            const from = msg?.from ? String(msg.from) : '';
            if (!from) continue;

            try {
              await WaChatController.handleIncomingMessage(tenantId, from, msg, contactNames.get(from));
            } catch (err) {
              log.error('handleIncomingMessage error', { error: String(err), from });
            }
          }

          // ── Status Updates (delivered/read) ──
          const statuses = Array.isArray(value.statuses) ? value.statuses as Record<string, unknown>[] : [];
          for (const st of statuses) {
            const waMessageId = st?.id ? String(st.id) : '';
            if (!waMessageId) continue;

            const rawStatus = String(st?.status || '').toLowerCase();
            const mappedStatus = rawStatus === 'read' ? 'read'
              : rawStatus === 'delivered' ? 'delivered'
              : rawStatus === 'sent' ? 'sent'
              : rawStatus === 'failed' ? 'failed'
              : null;

            if (mappedStatus) {
              await WaChatMessageService.updateStatus(waMessageId, mappedStatus,
                rawStatus === 'failed' ? WaChatController.extractErrorFromStatus(st) : undefined
              );

              // Publish real-time status update
              publishEvent('wa_chat:status_update', { tenant_id: tenantId, wa_message_id: waMessageId, status: mappedStatus });
            }
          }
        }
      }
    } catch (err) {
      log.error('receiveWebhook processing error', { error: String(err) });
    }
  }

  /** Process an incoming WhatsApp message */
  private static async handleIncomingMessage(
    tenantId: string,
    from: string,
    msg: Record<string, unknown>,
    contactName?: string,
  ) {
    // Upsert contact
    const contact = await WaChatContactService.upsert(tenantId, from, contactName);

    // Get or create conversation
    const conversation = await WaChatConversationService.getOrCreate(tenantId, from, contact.id);

    // Parse message content
    const msgType = String(msg?.type || 'text');
    const waMessageId = String(msg?.id || '');
    let body: string | undefined;
    let mediaUrl: string | undefined;
    let mediaMimeType: string | undefined;
    let mediaFilename: string | undefined;
    let mediaCaption: string | undefined;
    let reactionEmoji: string | undefined;
    let reactionMessageId: string | undefined;

    switch (msgType) {
      case 'text': {
        const text = msg?.text as Record<string, unknown> | undefined;
        body = typeof text?.body === 'string' ? text.body : '';
        break;
      }
      case 'image':
      case 'video':
      case 'audio':
      case 'document':
      case 'sticker': {
        const media = msg?.[msgType] as Record<string, unknown> | undefined;
        mediaUrl = media?.id ? String(media.id) : undefined; // Media ID — download separately
        mediaMimeType = media?.mime_type ? String(media.mime_type) : undefined;
        mediaFilename = media?.filename ? String(media.filename) : undefined;
        mediaCaption = media?.caption ? String(media.caption) : undefined;
        body = mediaCaption || `[${msgType}]`;
        break;
      }
      case 'reaction': {
        const reaction = msg?.reaction as Record<string, unknown> | undefined;
        reactionEmoji = reaction?.emoji ? String(reaction.emoji) : undefined;
        reactionMessageId = reaction?.message_id ? String(reaction.message_id) : undefined;
        body = reactionEmoji || '👍';
        break;
      }
      case 'location': {
        const loc = msg?.location as Record<string, unknown> | undefined;
        body = `📍 ${loc?.latitude || 0}, ${loc?.longitude || 0}`;
        break;
      }
      case 'contacts': {
        body = '[Contact card]';
        break;
      }
      case 'button': {
        const btn = msg?.button as Record<string, unknown> | undefined;
        body = typeof btn?.text === 'string' ? btn.text : '[Button reply]';
        break;
      }
      case 'interactive': {
        const interactive = msg?.interactive as Record<string, unknown> | undefined;
        const reply = (interactive?.button_reply || interactive?.list_reply) as Record<string, unknown> | undefined;
        body = reply?.title ? String(reply.title) : '[Interactive reply]';
        break;
      }
      default:
        body = `[${msgType}]`;
    }

    // Store the message
    const stored = await WaChatMessageService.storeInbound(tenantId, conversation.id, {
      wa_message_id: waMessageId,
      message_type: msgType,
      body,
      media_url: mediaUrl,
      media_mime_type: mediaMimeType,
      media_filename: mediaFilename,
      media_caption: mediaCaption,
      reaction_emoji: reactionEmoji,
      reaction_message_id: reactionMessageId,
      metadata: msg as Record<string, unknown>,
      timestamp: msg?.timestamp ? new Date(Number(msg.timestamp) * 1000) : undefined,
    });

    // Update conversation
    await query(
      `UPDATE wa_chat_conversations
       SET last_message_text = $1, last_message_at = NOW(), unread_count = unread_count + 1, status = 'active', updated_at = NOW()
       WHERE id = $2`,
      [(body || '').slice(0, 200), conversation.id]
    );

    // Create 24-hour messaging window for inbound messages
    try {
      await WaChatWindowService.createWindow(tenantId, conversation.id, from);
    } catch (err) {
      log.warn('Failed to create messaging window', { error: String(err) });
    }

    // Publish real-time event
    publishEvent('wa_chat:new_message', {
      tenant_id: tenantId,
      conversation_id: conversation.id,
      contact_id: contact.id,
      contact_name: contact.display_name || from,
      message: stored,
    });
  }

  private static extractErrorFromStatus(st: Record<string, unknown>): string | undefined {
    const errors = Array.isArray(st?.errors) ? (st.errors as Record<string, string>[]).map(e => e?.title || e?.message).filter(Boolean).join('; ') : undefined;
    return errors || undefined;
  }

  // ── Credentials Endpoints (Authenticated) ──────────────────────

  static async getCredentials(req: AuthRequest, res: Response) {
    try {
      const creds = await WaChatCredentialService.get(req.tenantId!);
      const config = await getWebhookConfig();
      
      if (!creds) return res.json({ 
        success: true, 
        credentials: null, 
        webhook_url: config.webhook_url, 
        verify_token: config.verify_token 
      });

      res.json({
        success: true,
        credentials: {
          phone_number_id: creds.phone_number_id,
          business_account_id: creds.business_account_id,
          display_name: creds.display_name,
          is_active: creds.is_active,
          last_verified_at: creds.last_verified_at,
          // Don't expose actual access_token — indicate it's set
          has_access_token: true,
        },
        webhook_url: config.webhook_url,
        verify_token: config.verify_token,
      });
    } catch (err) {
      log.error('getCredentials failed', { error: String(err) });
      res.status(500).json({ error: 'Failed to get credentials' });
    }
  }

  static async saveCredentials(req: AuthRequest, res: Response) {
    try {
      const data = SaveCredsSchema.parse(req.body);
      const result = await WaChatCredentialService.upsert(req.tenantId!, data);
      res.json({ success: true, credential_id: result.id });
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ error: 'Validation failed', details: err.errors });
      log.error('saveCredentials failed', { error: String(err) });
      res.status(500).json({ error: 'Failed to save credentials' });
    }
  }

  static async verifyCredentials(req: AuthRequest, res: Response) {
    try {
      const result = await WaChatCredentialService.verify(req.tenantId!);
      res.json({ success: true, ...result });
    } catch (err) {
      log.error('verifyCredentials failed', { error: String(err) });
      res.status(500).json({ error: 'Failed to verify credentials' });
    }
  }

  static async deleteCredentials(req: AuthRequest, res: Response) {
    try {
      await WaChatCredentialService.delete(req.tenantId!);
      res.json({ success: true });
    } catch (err) {
      log.error('deleteCredentials failed', { error: String(err) });
      res.status(500).json({ error: 'Failed to delete credentials' });
    }
  }

  // ── Conversation Endpoints ─────────────────────────────────────

  static async listConversations(req: AuthRequest, res: Response) {
    try {
      const opts = ListConversationsSchema.parse(req.query);
      const conversations = await WaChatConversationService.list(req.tenantId!, opts);
      res.json({ success: true, conversations });
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ error: 'Validation failed', details: err.errors });
      log.error('listConversations failed', { error: String(err) });
      res.status(500).json({ error: 'Failed to list conversations' });
    }
  }

  static async getConversation(req: AuthRequest, res: Response) {
    try {
      const convo = await WaChatConversationService.get(req.tenantId!, req.params.id);
      if (!convo) return res.status(404).json({ error: 'Conversation not found' });
      res.json({ success: true, conversation: convo });
    } catch (err) {
      log.error('getConversation failed', { error: String(err) });
      res.status(500).json({ error: 'Failed to get conversation' });
    }
  }

  static async markConversationRead(req: AuthRequest, res: Response) {
    try {
      await WaChatConversationService.markRead(req.tenantId!, req.params.id);
      res.json({ success: true });
    } catch (err) {
      log.error('markConversationRead failed', { error: String(err) });
      res.status(500).json({ error: 'Failed to mark read' });
    }
  }

  static async archiveConversation(req: AuthRequest, res: Response) {
    try {
      await WaChatConversationService.archive(req.tenantId!, req.params.id);
      res.json({ success: true });
    } catch (err) {
      log.error('archiveConversation failed', { error: String(err) });
      res.status(500).json({ error: 'Failed to archive' });
    }
  }

  static async pinConversation(req: AuthRequest, res: Response) {
    try {
      const pinned = req.body?.pinned !== false;
      await WaChatConversationService.pin(req.tenantId!, req.params.id, pinned);
      res.json({ success: true });
    } catch (err) {
      log.error('pinConversation failed', { error: String(err) });
      res.status(500).json({ error: 'Failed to pin' });
    }
  }

  // ── Messages Endpoints ─────────────────────────────────────────

  static async listMessages(req: AuthRequest, res: Response) {
    try {
      const opts = ListMessagesSchema.parse(req.query);
      const messages = await WaChatMessageService.list(req.tenantId!, req.params.id, opts);
      res.json({ success: true, messages });
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ error: 'Validation failed', details: err.errors });
      log.error('listMessages failed', { error: String(err) });
      res.status(500).json({ error: 'Failed to list messages' });
    }
  }

  static async sendText(req: AuthRequest, res: Response) {
    try {
      const { text } = SendTextSchema.parse(req.body);
      const convo = await WaChatConversationService.get(req.tenantId!, req.params.id);
      if (!convo) return res.status(404).json({ error: 'Conversation not found' });

      // Check 24-hour window
      const windowStatus = await WaChatWindowService.canSendMessage(convo.id);
      if (!windowStatus.canSend) {
        return res.status(400).json({ 
          error: 'Cannot send message outside 24-hour window',
          window_expired: true,
          time_remaining: 0
        });
      }

      const msg = await WaChatSendService.sendText(req.tenantId!, convo.id, convo.wa_id, text);
      res.json({ 
        success: true, 
        message: msg,
        window_time_remaining: windowStatus.timeRemaining
      });
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ error: 'Validation failed', details: err.errors });
      log.error('sendText failed', { error: String(err) });
      res.status(500).json({ error: 'Failed to send message' });
    }
  }

  static async getWindowStatus(req: AuthRequest, res: Response) {
    try {
      const convo = await WaChatConversationService.get(req.tenantId!, req.params.id);
      if (!convo) return res.status(404).json({ error: 'Conversation not found' });

      const windowStatus = await WaChatWindowService.canSendMessage(convo.id);
      res.json({
        success: true,
        can_send: windowStatus.canSend,
        time_remaining: windowStatus.timeRemaining,
        window_expires_in_hours: Math.floor(windowStatus.timeRemaining / (1000 * 60 * 60)),
        window_expires_in_minutes: Math.floor((windowStatus.timeRemaining % (1000 * 60 * 60)) / (1000 * 60))
      });
    } catch (err) {
      log.error('getWindowStatus failed', { error: String(err) });
      res.status(500).json({ error: 'Failed to get window status' });
    }
  }

  static async sendMedia(req: AuthRequest, res: Response) {
    try {
      const data = SendMediaSchema.parse(req.body);
      const convo = await WaChatConversationService.get(req.tenantId!, req.params.id);
      if (!convo) return res.status(404).json({ error: 'Conversation not found' });

      const msg = await WaChatSendService.sendMedia(req.tenantId!, convo.id, convo.wa_id, data);
      res.json({ success: true, message: msg });
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ error: 'Validation failed', details: err.errors });
      log.error('sendMedia failed', { error: String(err) });
      res.status(500).json({ error: 'Failed to send media' });
    }
  }

  // ── Contacts ───────────────────────────────────────────────────

  static async listContacts(req: AuthRequest, res: Response) {
    try {
      const search = req.query.search ? String(req.query.search) : undefined;
      const contacts = await WaChatContactService.list(req.tenantId!, search);
      res.json({ success: true, contacts });
    } catch (err) {
      log.error('listContacts failed', { error: String(err) });
      res.status(500).json({ error: 'Failed to list contacts' });
    }
  }

  // ── Test Message ───────────────────────────────────────────────────

  static async sendTestMessage(req: AuthRequest, res: Response) {
    try {
      const { phone, message } = req.body;
      
      // Enhanced validation with detailed error messages
      if (!phone) {
        return res.status(400).json({ 
          error: 'Phone number is required',
          details: 'Please provide a valid phone number in international format (e.g., +1234567890)'
        });
      }
      
      if (!message) {
        return res.status(400).json({ 
          error: 'Message is required',
          details: 'Please provide a message to send'
        });
      }

      // Validate phone number format
      if (!phone.match(/^\+[1-9]\d{1,14}$/)) {
        return res.status(400).json({ 
          error: 'Invalid phone number format',
          details: 'Phone number must be in international format starting with + (e.g., +1234567890)'
        });
      }

      // Check if credentials exist with detailed setup instructions
      const creds = await WaChatCredentialService.get(req.tenantId!);
      if (!creds) {
        return res.status(400).json({ 
          error: 'WhatsApp credentials not configured',
          details: 'Please configure WhatsApp Business API credentials first',
          setup_instructions: {
            step1: 'Go to WhatsApp Settings in the dashboard',
            step2: 'Add your Phone Number ID and Access Token',
            step3: 'Get credentials from Meta Business Manager',
            step4: 'Verify the configuration before testing'
          }
        });
      }

      // Validate credentials have required fields
      if (!creds.phone_number_id || !creds.access_token) {
        return res.status(400).json({ 
          error: 'Incomplete WhatsApp credentials',
          details: 'Missing phone_number_id or access_token in configuration'
        });
      }

      // 🔒 META COMPLIANCE CHECK - Validate message before sending
      const complianceCheck = await ComplianceService.validateMessage({
        tenantId: req.tenantId!,
        phoneNumber: phone,
        messageType: 'text',
        messageContent: message
      });

      if (!complianceCheck.approved) {
        return res.status(400).json({
          error: 'Message blocked by compliance system',
          details: complianceCheck.reason,
          compliance_info: {
            message: 'This message violates Meta WhatsApp Business Platform policies',
            action_required: 'Please ensure you have explicit opt-in consent and follow content guidelines',
            help_url: '/legal/acceptable-use-policy'
          }
        });
      }

      log.info('Starting WhatsApp test message', { 
        phone: phone.substring(0, 5) + '***', 
        tenantId: req.tenantId,
        hasCredentials: !!creds 
      });

      // Create or get contact for test number
      const contact = await WaChatContactService.upsert(req.tenantId!, phone, `Test Contact ${phone}`);
      
      // Create or get conversation for test number
      const conversation = await WaChatConversationService.getOrCreate(req.tenantId!, phone, contact.id);

      // Send test message with enhanced error handling
      try {
        const msg = await WaChatSendService.sendText(req.tenantId!, conversation.id, phone, message);
        
        log.info('Test message sent successfully', { 
          phone: phone.substring(0, 5) + '***', 
          messageId: msg.wa_message_id,
          conversationId: conversation.id
        });

        // 📊 LOG MESSAGE FOR COMPLIANCE AUDIT
        await ComplianceService.logMessage({
          tenantId: req.tenantId!,
          phoneNumber: phone,
          messageType: 'text',
          messageContent: message,
          optInVerified: complianceCheck.approved,
          complianceStatus: 'approved'
        });
        
        res.json({ 
          success: true, 
          message: msg, 
          conversation_id: conversation.id,
          details: 'Test message sent successfully! Check your WhatsApp chat interface.',
          compliance_status: 'approved'
        });
      } catch (sendError: any) {
        log.error('WhatsApp API send failed', { error: String(sendError) });
        
        // Handle specific WhatsApp API errors
        if (sendError.message.includes('Invalid phone number')) {
          return res.status(400).json({ 
            error: 'Invalid phone number for WhatsApp',
            details: 'The phone number is not registered with WhatsApp or is invalid'
          });
        }
        
        if (sendError.message.includes('Access token')) {
          return res.status(400).json({ 
            error: 'WhatsApp API authentication failed',
            details: 'Access token is invalid or expired. Please update your credentials.'
          });
        }
        
        return res.status(500).json({ 
          error: 'WhatsApp API error',
          details: sendError.message || 'Failed to send message via WhatsApp API'
        });
      }
      
    } catch (err: any) {
      log.error('sendTestMessage failed', { error: String(err), stack: err.stack });
      res.status(500).json({ 
        error: 'Internal server error',
        details: 'An unexpected error occurred while processing the test message'
      });
    }
  }
}
