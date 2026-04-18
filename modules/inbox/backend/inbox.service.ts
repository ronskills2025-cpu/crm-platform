import { query } from '../../../packages/db/src/connection';
import { incrCounter, publishEvent, todayKey } from '../../../packages/db/src/redis';
import { createLogger } from '../../../packages/utils/src/logger';
import type { InboxChannel, IncomingMessageInput, ReplyMessageInput } from './Inbox';
import { WhatsAppService } from '../../../modules/whatsapp/backend/whatsapp.service';
import { SMSService } from '../../../modules/sms/backend/sms.service';
import { EmailService } from '../../../modules/email/backend/email.service';
import { TelegramService } from '../../../modules/telegram/backend/telegram.service';
import { MessengerService } from '../../../modules/messenger/backend/messenger.service';
import { LeadsService } from '../../../modules/leads/backend/leads.service';
import { automationQueue, botManagerQueue } from '../../../packages/utils/src/queues';

const log = createLogger('inbox');

export interface ConversationThread {
  id: string;
  channel: InboxChannel;
  campaign_id: string | null;
  campaign_name?: string | null;
  contact_value: string;
  contact_name: string | null;
  lead_name: string | null;
  is_vip: boolean;
  assigned_to: string | null;
  status: 'unread' | 'read' | 'replied';
  unread_count: number;
  last_message_preview: string | null;
  last_message_at: Date;
  metadata: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
}

export interface ConversationMessage {
  id: string;
  thread_id: string;
  channel: InboxChannel;
  campaign_id: string | null;
  direction: 'inbound' | 'outbound';
  provider_used: string | null;
  external_message_id: string | null;
  sender: string;
  recipient: string | null;
  subject: string | null;
  body: string;
  status: 'queued' | 'sent' | 'delivered' | 'failed' | 'received' | 'read';
  error_message: string | null;
  assigned_to: string | null;
  retry_count: number;
  metadata: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
}

function previewText(text: string, length = 120): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  return clean.length <= length ? clean : `${clean.slice(0, length)}…`;
}

function normalizeContact(channel: InboxChannel, raw: string): string {
  const value = raw.trim();
  if (channel === 'email') return value.toLowerCase();
  return value.replace(/\s+/g, '').replace(/^\+/, '');
}

export function buildReplySubject(existing?: string | null): string {
  if (!existing) return 'Re: CRM Conversation';
  return /^re:/i.test(existing) ? existing : `Re: ${existing}`;
}

async function findCampaignForIncoming(channel: InboxChannel, contactValue: string): Promise<{ campaignId: string | null; providerUsed: string | null }> {
  if (channel === 'whatsapp') {
    const result = await query<{ campaignId: string | null; providerUsed: string | null }>(
      `SELECT campaign_id AS "campaignId", provider_used AS "providerUsed"
       FROM whatsapp_messages
       WHERE phone = $1
       ORDER BY created_at DESC
       LIMIT 1`,
      [contactValue]
    );
    return result.rows[0] ?? { campaignId: null, providerUsed: null };
  }

  if (channel === 'sms') {
    const result = await query<{ campaignId: string | null; providerUsed: string | null }>(
      `SELECT campaign_id AS "campaignId", provider_used AS "providerUsed"
       FROM sms_messages
       WHERE phone = $1
       ORDER BY created_at DESC
       LIMIT 1`,
      [contactValue]
    );
    return result.rows[0] ?? { campaignId: null, providerUsed: null };
  }

  if (channel === 'telegram') {
    const result = await query<{ campaignId: string | null; providerUsed: string | null }>(
      `SELECT campaign_id AS "campaignId", provider_used AS "providerUsed"
       FROM telegram_messages
       WHERE chat_id = $1
       ORDER BY created_at DESC
       LIMIT 1`,
      [contactValue]
    );
    return result.rows[0] ?? { campaignId: null, providerUsed: null };
  }

  if (channel === 'messenger') {
    const result = await query<{ campaignId: string | null; providerUsed: string | null }>(
      `SELECT campaign_id AS "campaignId", provider_used AS "providerUsed"
       FROM messenger_messages
       WHERE recipient_id = $1
       ORDER BY created_at DESC
       LIMIT 1`,
      [contactValue]
    );
    return result.rows[0] ?? { campaignId: null, providerUsed: null };
  }

  if (channel === 'instagram') {
    const result = await query<{ campaignId: string | null; providerUsed: string | null }>(
      `SELECT campaign_id AS "campaignId", provider_used AS "providerUsed"
       FROM instagram_messages
       WHERE recipient_id = $1
       ORDER BY created_at DESC
       LIMIT 1`,
      [contactValue]
    );
    return result.rows[0] ?? { campaignId: null, providerUsed: null };
  }

  const result = await query<{ campaignId: string | null; providerUsed: string | null }>(
    `SELECT campaign_id AS "campaignId", provider_used AS "providerUsed"
     FROM email_messages
     WHERE to_email = $1 OR from_email = $1
     ORDER BY created_at DESC
     LIMIT 1`,
    [contactValue]
  );
  return result.rows[0] ?? { campaignId: null, providerUsed: null };
}

async function resolveReplyProvider(channel: InboxChannel, preferred?: string | null): Promise<string> {
  if (preferred) return preferred;

  if (channel === 'whatsapp') {
    const chain = await WhatsAppService.getSortedProviders();
    return chain[0] || 'meta';
  }
  if (channel === 'sms') {
    const chain = await SMSService.getSortedProviders();
    return chain[0] || 'fast2sms';
  }

  if (channel === 'telegram') {
    const chain = await TelegramService.getSortedProviders();
    return chain[0] || 'telegram_bot';
  }

  if (channel === 'messenger') {
    const chain = await MessengerService.getSortedProviders();
    return chain[0] || 'fb_page';
  }

  const chain = await EmailService.getSortedProviders();
  return chain[0] || 'smtp';
}

async function storeOutboundChannelMessage(
  thread: ConversationThread,
  provider: string,
  status: 'sent' | 'failed',
  body: string,
  subject?: string,
  providerMsgId?: string,
  error?: string,
  cost = 0
) {
  if (thread.channel === 'whatsapp') {
    await query(
      `INSERT INTO whatsapp_messages (campaign_id, phone, message, status, provider_used, provider_msg_id, attempts, error_message, cost, sent_at)
       VALUES ($1, $2, $3, $4, $5, $6, 1, $7, $8, CASE WHEN $4 = 'sent' THEN NOW() ELSE NULL END)`,
      [thread.campaign_id, thread.contact_value, body, status, provider, providerMsgId ?? null, error ?? null, cost]
    );
    return;
  }

  if (thread.channel === 'sms') {
    await query(
      `INSERT INTO sms_messages (campaign_id, phone, message, status, provider_used, provider_msg_id, attempts, error_message, cost, sent_at)
       VALUES ($1, $2, $3, $4, $5, $6, 1, $7, $8, CASE WHEN $4 = 'sent' THEN NOW() ELSE NULL END)`,
      [thread.campaign_id, thread.contact_value, body, status, provider, providerMsgId ?? null, error ?? null, cost]
    );
    return;
  }

  if (thread.channel === 'telegram') {
    await query(
      `INSERT INTO telegram_messages (campaign_id, chat_id, message, status, provider_used, provider_msg_id, attempts, error_message, cost, sent_at)
       VALUES ($1, $2, $3, $4, $5, $6, 1, $7, $8, CASE WHEN $4 = 'sent' THEN NOW() ELSE NULL END)`,
      [thread.campaign_id, thread.contact_value, body, status, provider, providerMsgId ?? null, error ?? null, cost]
    );
    return;
  }

  if (thread.channel === 'messenger') {
    await query(
      `INSERT INTO messenger_messages (campaign_id, recipient_id, message, message_type, status, provider_used, provider_msg_id, attempts, error_message, cost, sent_at)
       VALUES ($1, $2, $3, 'text', $4, $5, $6, 1, $7, $8, CASE WHEN $4 = 'sent' THEN NOW() ELSE NULL END)`,
      [thread.campaign_id, thread.contact_value, body, status, provider, providerMsgId ?? null, error ?? null, cost]
    );
    return;
  }

  await query(
    `INSERT INTO email_messages (campaign_id, to_email, from_email, subject, text_body, status, provider_used, provider_msg_id, attempts, error_message, cost, sent_at)
     VALUES ($1, $2, NULL, $3, $4, $5, $6, $7, 1, $8, $9, CASE WHEN $5 = 'sent' THEN NOW() ELSE NULL END)`,
    [thread.campaign_id, thread.contact_value, subject ?? buildReplySubject(null), body, status, provider, providerMsgId ?? null, error ?? null, cost]
  );
}

export class InboxService {
  static async getStats(tenantId?: string) {
    const params: unknown[] = [];
    let where = '';
    if (tenantId) { params.push(tenantId); where = `WHERE tenant_id = $${params.length}`; }
    const result = await query<{ channel: InboxChannel; unread_count: number; thread_count: number }>(
      `SELECT channel,
              COALESCE(SUM(unread_count), 0)::int AS unread_count,
              COUNT(*)::int AS thread_count
       FROM conversation_threads
       ${where}
       GROUP BY channel`,
      params
    );

    const base = {
      whatsapp: { unread: 0, threads: 0 },
      sms: { unread: 0, threads: 0 },
      email: { unread: 0, threads: 0 },
      telegram: { unread: 0, threads: 0 },
      messenger: { unread: 0, threads: 0 },
      instagram: { unread: 0, threads: 0 },
    };

    for (const row of result.rows) {
      base[row.channel] = {
        unread: Number(row.unread_count),
        threads: Number(row.thread_count),
      };
    }

    return base;
  }

  static async listThreads(channel: InboxChannel, opts?: { search?: string; status?: string; assigned_to?: string; vip_only?: boolean; limit?: number; offset?: number; tenant_id?: string }): Promise<{ rows: ConversationThread[]; total: number }> {
    const params: unknown[] = [channel];
    const conditions = ['t.channel = $1'];

    if (opts?.tenant_id) {
      params.push(opts.tenant_id);
      conditions.push(`t.tenant_id = $${params.length}`);
    }

    if (opts?.search) {
      params.push(`%${opts.search}%`);
      conditions.push(`(t.contact_value ILIKE $${params.length} OR COALESCE(t.contact_name, '') ILIKE $${params.length} OR COALESCE(t.lead_name, '') ILIKE $${params.length} OR COALESCE(c.name, '') ILIKE $${params.length})`);
    }

    if (opts?.status && opts.status !== 'all') {
      params.push(opts.status);
      conditions.push(`t.status = $${params.length}`);
    }

    if (opts?.assigned_to) {
      params.push(opts.assigned_to);
      conditions.push(`COALESCE(t.assigned_to, '') = $${params.length}`);
    }

    if (opts?.vip_only) {
      conditions.push('t.is_vip = true');
    }

    const whereClause = conditions.join(' AND ');
    const countResult = await query<{ count: string }>(
      `SELECT COUNT(*)::int as count FROM conversation_threads t LEFT JOIN campaigns c ON c.id = t.campaign_id WHERE ${whereClause}`,
      params.slice()
    );

    params.push(opts?.limit ?? 50);
    params.push(opts?.offset ?? 0);

    const result = await query<ConversationThread>(
      `SELECT t.*, c.name AS campaign_name
       FROM conversation_threads t
       LEFT JOIN campaigns c ON c.id = t.campaign_id
       WHERE ${whereClause}
       ORDER BY t.last_message_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    return { rows: result.rows, total: Number(countResult.rows[0]?.count ?? 0) };
  }

  static async getThread(threadId: string) {
    const threadResult = await query<ConversationThread>(
      `SELECT t.*, c.name AS campaign_name
       FROM conversation_threads t
       LEFT JOIN campaigns c ON c.id = t.campaign_id
       WHERE t.id = $1`,
      [threadId]
    );
    const thread = threadResult.rows[0] ?? null;
    if (!thread) return null;

    const messageResult = await query<ConversationMessage>(
      `SELECT * FROM conversation_messages WHERE thread_id = $1 ORDER BY created_at ASC`,
      [threadId]
    );

    return { thread, messages: messageResult.rows };
  }

  static async receiveIncoming(input: IncomingMessageInput) {
    const contactValue = normalizeContact(input.channel, input.sender);
    const mapping = input.campaign_id
      ? { campaignId: input.campaign_id, providerUsed: input.provider ?? null }
      : await findCampaignForIncoming(input.channel, contactValue);

    const existingThread = await query<ConversationThread>(
      `SELECT * FROM conversation_threads WHERE channel = $1 AND contact_value = $2 LIMIT 1`,
      [input.channel, contactValue]
    );

    const metadata = input.metadata ?? {};
    let threadId: string;

    if (existingThread.rows[0]) {
      threadId = existingThread.rows[0].id;
      await query(
        `UPDATE conversation_threads
         SET campaign_id = COALESCE(campaign_id, $2),
             contact_name = COALESCE($3, contact_name),
             lead_name = COALESCE($4, lead_name),
             is_vip = COALESCE($5, is_vip),
             assigned_to = COALESCE($6, assigned_to),
             status = 'unread',
             unread_count = unread_count + 1,
             last_message_preview = $7,
             last_message_at = NOW(),
             metadata = COALESCE(metadata, '{}'::jsonb) || $8::jsonb,
             updated_at = NOW()
         WHERE id = $1`,
        [
          threadId,
          mapping.campaignId,
          input.metadata?.contact_name as string | undefined,
          input.lead_name ?? null,
          input.is_vip ?? null,
          input.assigned_to ?? null,
          previewText(input.body),
          JSON.stringify(metadata),
        ]
      );
    } else {
      const inserted = await query<{ id: string }>(
        `INSERT INTO conversation_threads (channel, campaign_id, contact_value, contact_name, lead_name, is_vip, assigned_to, status, unread_count, last_message_preview, last_message_at, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'unread', 1, $8, NOW(), $9)
         RETURNING id`,
        [
          input.channel,
          mapping.campaignId,
          contactValue,
          (input.metadata?.contact_name as string | undefined) ?? null,
          input.lead_name ?? null,
          input.is_vip ?? false,
          input.assigned_to ?? null,
          previewText(input.body),
          JSON.stringify(metadata),
        ]
      );
      threadId = inserted.rows[0].id;
    }

    const msg = await query<{ id: string }>(
      `INSERT INTO conversation_messages (thread_id, channel, campaign_id, direction, provider_used, external_message_id, sender, recipient, subject, body, status, assigned_to, metadata)
       VALUES ($1, $2, $3, 'inbound', $4, $5, $6, $7, $8, $9, 'received', $10, $11)
       RETURNING id`,
      [
        threadId,
        input.channel,
        mapping.campaignId,
        input.provider ?? mapping.providerUsed,
        input.external_message_id ?? null,
        input.sender,
        input.recipient ?? null,
        input.subject ?? null,
        input.body,
        input.assigned_to ?? null,
        JSON.stringify(metadata),
      ]
    );

    await incrCounter(`inbox:${input.channel}:incoming:${todayKey()}`);
    publishEvent('inbox:new_message', {
      channel: input.channel,
      thread_id: threadId,
      message_id: msg.rows[0].id,
      sender: input.sender,
      preview: previewText(input.body),
      campaign_id: mapping.campaignId,
      is_vip: input.is_vip ?? false,
    });

    // Upsert lead — await to ensure tenant isolation, but don't block response on failure
    LeadsService.upsertFromIncoming(
      input.channel as 'whatsapp' | 'sms' | 'email' | 'telegram' | 'messenger' | 'instagram',
      input.sender,
      {
        name: (input.metadata?.contact_name as string | undefined) ?? input.lead_name ?? undefined,
        source: input.channel,
        campaign_id: mapping.campaignId ?? undefined,
        is_vip: input.is_vip,
        assigned_to: input.assigned_to ?? undefined,
      }
    ).catch((e) => log.error('Lead upsert failed', e));

    automationQueue.add('trigger', {
      action: 'evaluate_trigger',
      triggerType: 'message_received',
      channel: input.channel,
      data: {
        thread_id: threadId,
        message_id: msg.rows[0].id,
        sender: input.sender,
        body: input.body,
        channel: input.channel,
        campaign_id: mapping.campaignId,
        is_vip: input.is_vip ?? false,
      },
    }).catch((e) => log.error('Automation trigger failed', e));

    // Trigger bot manager for incoming messages
    botManagerQueue.add('process_message', {
      action: 'process_message',
      channel: input.channel,
      contact_value: input.sender,
      contact_name: (input.metadata?.contact_name as string | undefined) ?? input.lead_name,
      message: input.body,
      thread_id: threadId,
      metadata: input.metadata,
    }).catch((e) => log.error('Bot trigger failed', e));

    return { threadId, messageId: msg.rows[0].id };
  }

  static async markThreadRead(threadId: string) {
    const result = await query<ConversationThread>(
      `UPDATE conversation_threads
       SET status = 'read', unread_count = 0, updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [threadId]
    );
    const thread = result.rows[0] ?? null;
    if (thread) {
      publishEvent('inbox:thread_read', {
        channel: thread.channel,
        thread_id: threadId,
      });
    }
    return thread;
  }

  static async assignThread(threadId: string, assignedTo: string) {
    const result = await query<ConversationThread>(
      `UPDATE conversation_threads
       SET assigned_to = $2, updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [threadId, assignedTo]
    );
    const thread = result.rows[0] ?? null;
    if (thread) {
      publishEvent('inbox:assigned', {
        channel: thread.channel,
        thread_id: threadId,
        assigned_to: assignedTo,
      });
    }
    return thread;
  }

  static async updateDeliveryStatus(
    channel: InboxChannel,
    externalMessageId: string,
    status: 'sent' | 'delivered' | 'failed' | 'read',
    errorMessage?: string
  ) {
    const messageResult = await query<{ thread_id: string }>(
      `UPDATE conversation_messages
       SET status = $3,
           error_message = COALESCE($4, error_message),
           updated_at = NOW()
       WHERE channel = $1 AND external_message_id = $2
       RETURNING thread_id`,
      [channel, externalMessageId, status, errorMessage ?? null]
    );

    const tableMap = { whatsapp: 'whatsapp_messages', sms: 'sms_messages', email: 'email_messages', telegram: 'telegram_messages', messenger: 'messenger_messages', instagram: 'instagram_messages' } as const;
    const tableName = tableMap[channel as keyof typeof tableMap];
    if (tableName) {
      await query(
        `UPDATE ${tableName} SET status = $2, error_message = COALESCE($3, error_message) WHERE provider_msg_id = $1`,
        [externalMessageId, status, errorMessage ?? null]
      );
    }

    if (messageResult.rows[0]) {
      publishEvent('inbox:status_updated', {
        channel,
        thread_id: messageResult.rows[0].thread_id,
        external_message_id: externalMessageId,
        status,
        error: errorMessage ?? null,
      });
    }

    return { updated: (messageResult.rowCount ?? 0) > 0 };
  }

  static async sendReply(threadId: string, input: ReplyMessageInput) {
    const threadDetails = await this.getThread(threadId);
    if (!threadDetails) throw new Error('Conversation thread not found');
    const { thread, messages } = threadDetails;

    const provider = await resolveReplyProvider(thread.channel, input.provider ?? null);
    const lastInboundSubject = [...messages].reverse().find((message) => message.direction === 'inbound')?.subject;

    let result: { success: boolean; messageId?: string; error?: string; cost?: number };
    if (thread.channel === 'whatsapp') {
      result = await WhatsAppService.sendViaProvider(provider, thread.contact_value, input.body);
    } else if (thread.channel === 'sms') {
      result = await SMSService.sendViaProvider(provider, thread.contact_value, input.body);
    } else if (thread.channel === 'telegram') {
      result = await TelegramService.sendViaProvider(provider, thread.contact_value, input.body);
    } else if (thread.channel === 'messenger') {
      result = await MessengerService.sendViaProvider(provider, thread.contact_value, input.body);
    } else {
      const subject = input.subject || buildReplySubject(lastInboundSubject ?? null);
      result = await EmailService.sendViaProvider(provider, thread.contact_value, subject, undefined, input.body);
    }

    const messageInsert = await query<{ id: string }>(
      `INSERT INTO conversation_messages (thread_id, channel, campaign_id, direction, provider_used, external_message_id, sender, recipient, subject, body, status, error_message, assigned_to, metadata)
       VALUES ($1, $2, $3, 'outbound', $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       RETURNING id`,
      [
        thread.id,
        thread.channel,
        thread.campaign_id,
        provider,
        result.messageId ?? null,
        input.assigned_to ?? 'crm-operator',
        thread.contact_value,
        input.subject || (thread.channel === 'email' ? buildReplySubject(lastInboundSubject ?? null) : null),
        input.body,
        result.success ? 'sent' : 'failed',
        result.error ?? null,
        input.assigned_to ?? thread.assigned_to ?? null,
        JSON.stringify({ source: 'crm-reply' }),
      ]
    );

    await storeOutboundChannelMessage(
      thread,
      provider,
      result.success ? 'sent' : 'failed',
      input.body,
      input.subject || buildReplySubject(lastInboundSubject ?? null),
      result.messageId,
      result.error,
      result.cost || 0
    );

    await query(
      `UPDATE conversation_threads
       SET status = $2,
           unread_count = CASE WHEN $2 = 'replied' THEN 0 ELSE unread_count END,
           last_message_preview = $3,
           last_message_at = NOW(),
           assigned_to = COALESCE($4, assigned_to),
           updated_at = NOW()
       WHERE id = $1`,
      [thread.id, result.success ? 'replied' : 'read', previewText(input.body), input.assigned_to ?? null]
    );

    if (result.success) {
      publishEvent('inbox:reply_sent', {
        channel: thread.channel,
        thread_id: thread.id,
        message_id: messageInsert.rows[0].id,
        recipient: thread.contact_value,
      });
    } else {
      await query(
        `INSERT INTO campaign_errors (campaign_id, channel, recipient, provider, error_message, retryable, details)
         VALUES ($1, $2, $3, $4, $5, true, $6)`,
        [thread.campaign_id, thread.channel, thread.contact_value, provider, result.error ?? 'Reply failed', JSON.stringify({ thread_id: thread.id, message_id: messageInsert.rows[0].id })]
      );
      publishEvent('inbox:reply_failed', {
        channel: thread.channel,
        thread_id: thread.id,
        message_id: messageInsert.rows[0].id,
        recipient: thread.contact_value,
        error: result.error ?? 'Reply failed',
      });
    }

    return { success: result.success, messageId: messageInsert.rows[0].id, provider, error: result.error };
  }

  static async retryReply(messageId: string) {
    const result = await query<ConversationMessage>(
      `SELECT * FROM conversation_messages WHERE id = $1 AND direction = 'outbound'`,
      [messageId]
    );
    const message = result.rows[0] ?? null;
    if (!message) throw new Error('Reply message not found');

    await query(
      `UPDATE conversation_messages SET retry_count = retry_count + 1, updated_at = NOW() WHERE id = $1`,
      [messageId]
    );

    return this.sendReply(message.thread_id, {
      body: message.body,
      subject: message.subject ?? undefined,
      provider: message.provider_used ?? undefined,
      assigned_to: message.assigned_to ?? undefined,
    });
  }

  static async exportThread(threadId: string) {
    const details = await this.getThread(threadId);
    if (!details) throw new Error('Conversation thread not found');
    return details;
  }
}
