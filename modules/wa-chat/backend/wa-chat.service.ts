import { query } from '../../../packages/db/src/connection';
import { publishEvent } from '../../../packages/db/src/redis';
import { createLogger } from '../../../packages/utils/src/logger';
import crypto from 'crypto';

const log = createLogger('svc:wa-chat');

const GRAPH_API = 'https://graph.facebook.com/v18.0';

// ── Credential encryption (AES-256-GCM) ──────────────────────────

const ENC_KEY = process.env.WA_CHAT_ENC_KEY || crypto.randomBytes(32).toString('hex');

function getEncKey(): Buffer {
  return Buffer.from(ENC_KEY.padEnd(64, '0').slice(0, 64), 'hex');
}

function encrypt(text: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-gcm', getEncKey(), iv);
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
}

function decrypt(data: string): string {
  const [ivHex, tagHex, encHex] = data.split(':');
  const decipher = crypto.createDecipheriv('aes-256-gcm', getEncKey(), Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
  return decipher.update(Buffer.from(encHex, 'hex')) + decipher.final('utf8');
}

// ── Credentials CRUD ─────────────────────────────────────────────

export class WaChatCredentialService {
  static async get(tenantId: string) {
    const result = await query<{
      id: string; phone_number_id: string; access_token: string;
      business_account_id: string | null; display_name: string | null;
      phone_display: string | null; is_active: boolean;
      token_expires_at: Date | null; last_verified_at: Date | null;
    }>(
      `SELECT * FROM wa_chat_credentials WHERE tenant_id = $1 AND is_active = true ORDER BY created_at DESC LIMIT 1`,
      [tenantId]
    );
    if (!result.rows[0]) return null;
    const row = result.rows[0];
    try {
      return { ...row, access_token: decrypt(row.access_token) };
    } catch {
      return { ...row, access_token: row.access_token };
    }
  }

  static async upsert(tenantId: string, data: {
    phone_number_id: string;
    access_token: string;
    business_account_id?: string;
    display_name?: string;
  }) {
    const encToken = encrypt(data.access_token);
    const result = await query(
      `INSERT INTO wa_chat_credentials (tenant_id, phone_number_id, access_token, business_account_id, display_name)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (tenant_id, phone_number_id)
       DO UPDATE SET access_token = $3, business_account_id = $4, display_name = $5, updated_at = NOW()
       RETURNING *`,
      [tenantId, data.phone_number_id, encToken, data.business_account_id || null, data.display_name || null]
    );
    return result.rows[0];
  }

  static async verify(tenantId: string): Promise<{ valid: boolean; error?: string }> {
    const creds = await WaChatCredentialService.get(tenantId);
    if (!creds) return { valid: false, error: 'No credentials found' };

    try {
      const res = await fetch(`${GRAPH_API}/${creds.phone_number_id}?access_token=${creds.access_token}`, {
        signal: AbortSignal.timeout(10000),
      });
      if (!res.ok) {
        const body = await res.text();
        return { valid: false, error: `Meta API ${res.status}: ${body.slice(0, 200)}` };
      }
      await query(
        `UPDATE wa_chat_credentials SET last_verified_at = NOW() WHERE tenant_id = $1 AND phone_number_id = $2`,
        [tenantId, creds.phone_number_id]
      );
      return { valid: true };
    } catch (err) {
      return { valid: false, error: err instanceof Error ? err.message : 'Verification failed' };
    }
  }

  static async delete(tenantId: string) {
    const result = await query(`DELETE FROM wa_chat_credentials WHERE tenant_id = $1`, [tenantId]);
    return (result.rowCount ?? 0) > 0;
  }
}

// ── Contacts ─────────────────────────────────────────────────────

export class WaChatContactService {
  static async upsert(tenantId: string, waId: string, name?: string) {
    const result = await query(
      `INSERT INTO wa_chat_contacts (tenant_id, wa_id, display_name, phone, last_message_at)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (tenant_id, wa_id)
       DO UPDATE SET display_name = COALESCE($3, wa_chat_contacts.display_name), last_message_at = NOW(), updated_at = NOW()
       RETURNING *`,
      [tenantId, waId, name || null, waId]
    );
    return result.rows[0];
  }

  static async list(tenantId: string, search?: string) {
    let sql = `SELECT * FROM wa_chat_contacts WHERE tenant_id = $1 AND is_blocked = false`;
    const params: unknown[] = [tenantId];
    if (search) {
      sql += ` AND (display_name ILIKE $2 OR wa_id ILIKE $2 OR phone ILIKE $2)`;
      params.push(`%${search}%`);
    }
    sql += ` ORDER BY last_message_at DESC NULLS LAST LIMIT 200`;
    const result = await query(sql, params);
    return result.rows;
  }

  static async get(tenantId: string, contactId: string) {
    const result = await query(
      `SELECT * FROM wa_chat_contacts WHERE tenant_id = $1 AND id = $2`, [tenantId, contactId]
    );
    return result.rows[0] || null;
  }
}

// ── Conversations ────────────────────────────────────────────────

export class WaChatConversationService {
  static async getOrCreate(tenantId: string, waId: string, contactId: string) {
    // Try to find existing
    const existing = await query(
      `SELECT * FROM wa_chat_conversations WHERE tenant_id = $1 AND wa_id = $2`,
      [tenantId, waId]
    );
    if (existing.rows[0]) return existing.rows[0];

    const result = await query(
      `INSERT INTO wa_chat_conversations (tenant_id, contact_id, wa_id)
       VALUES ($1, $2, $3) RETURNING *`,
      [tenantId, contactId, waId]
    );
    return result.rows[0];
  }

  static async list(tenantId: string, opts?: { search?: string; status?: string; limit?: number; offset?: number }) {
    let sql = `
      SELECT c.*, ct.display_name AS contact_name, ct.phone AS contact_phone, ct.profile_pic_url
      FROM wa_chat_conversations c
      LEFT JOIN wa_chat_contacts ct ON c.contact_id = ct.id
      WHERE c.tenant_id = $1`;
    const params: unknown[] = [tenantId];
    let idx = 2;

    if (opts?.status) {
      sql += ` AND c.status = $${idx++}`;
      params.push(opts.status);
    }
    if (opts?.search) {
      sql += ` AND (ct.display_name ILIKE $${idx} OR ct.wa_id ILIKE $${idx} OR ct.phone ILIKE $${idx})`;
      params.push(`%${opts.search}%`);
      idx++;
    }
    sql += ` ORDER BY c.is_pinned DESC, c.last_message_at DESC NULLS LAST`;
    sql += ` LIMIT $${idx++} OFFSET $${idx}`;
    params.push(opts?.limit || 50, opts?.offset || 0);

    const result = await query(sql, params);
    return result.rows;
  }

  static async get(tenantId: string, conversationId: string) {
    const result = await query(
      `SELECT c.*, ct.display_name AS contact_name, ct.phone AS contact_phone, ct.wa_id, ct.profile_pic_url
       FROM wa_chat_conversations c
       LEFT JOIN wa_chat_contacts ct ON c.contact_id = ct.id
       WHERE c.id = $1 AND c.tenant_id = $2`,
      [conversationId, tenantId]
    );
    return result.rows[0] || null;
  }

  static async markRead(tenantId: string, conversationId: string) {
    await query(
      `UPDATE wa_chat_conversations SET unread_count = 0, updated_at = NOW() WHERE id = $1 AND tenant_id = $2`,
      [conversationId, tenantId]
    );
    publishEvent('wa_chat:read', { tenant_id: tenantId, conversation_id: conversationId });
  }

  static async archive(tenantId: string, conversationId: string) {
    await query(
      `UPDATE wa_chat_conversations SET status = 'archived', updated_at = NOW() WHERE id = $1 AND tenant_id = $2`,
      [conversationId, tenantId]
    );
  }

  static async pin(tenantId: string, conversationId: string, pinned: boolean) {
    await query(
      `UPDATE wa_chat_conversations SET is_pinned = $3, updated_at = NOW() WHERE id = $1 AND tenant_id = $2`,
      [conversationId, tenantId, pinned]
    );
  }
}

// ── Messages ─────────────────────────────────────────────────────

export class WaChatMessageService {
  static async list(tenantId: string, conversationId: string, opts?: { limit?: number; before?: string }) {
    let sql = `SELECT * FROM wa_chat_messages WHERE tenant_id = $1 AND conversation_id = $2`;
    const params: unknown[] = [tenantId, conversationId];
    let idx = 3;
    if (opts?.before) {
      sql += ` AND timestamp < $${idx++}`;
      params.push(opts.before);
    }
    sql += ` ORDER BY timestamp DESC LIMIT $${idx}`;
    params.push(opts?.limit || 50);
    const result = await query(sql, params);
    return result.rows.reverse(); // Return oldest → newest
  }

  static async storeInbound(tenantId: string, conversationId: string, data: {
    wa_message_id: string;
    message_type: string;
    body?: string;
    media_url?: string;
    media_mime_type?: string;
    media_filename?: string;
    media_caption?: string;
    reaction_emoji?: string;
    reaction_message_id?: string;
    metadata?: Record<string, unknown>;
    timestamp?: Date;
  }) {
    const result = await query(
      `INSERT INTO wa_chat_messages
       (tenant_id, conversation_id, wa_message_id, direction, message_type, body,
        media_url, media_mime_type, media_filename, media_caption,
        reaction_emoji, reaction_message_id, status, metadata, timestamp)
       VALUES ($1, $2, $3, 'inbound', $4, $5, $6, $7, $8, $9, $10, $11, 'delivered', $12, $13)
       ON CONFLICT DO NOTHING
       RETURNING *`,
      [
        tenantId, conversationId, data.wa_message_id, data.message_type || 'text',
        data.body || null, data.media_url || null, data.media_mime_type || null,
        data.media_filename || null, data.media_caption || null,
        data.reaction_emoji || null, data.reaction_message_id || null,
        JSON.stringify(data.metadata || {}), data.timestamp || new Date(),
      ]
    );
    return result.rows[0] || null;
  }

  static async storeOutbound(tenantId: string, conversationId: string, data: {
    wa_message_id?: string;
    message_type: string;
    body?: string;
    media_url?: string;
    media_mime_type?: string;
    media_filename?: string;
    status?: string;
    metadata?: Record<string, unknown>;
  }) {
    const result = await query(
      `INSERT INTO wa_chat_messages
       (tenant_id, conversation_id, wa_message_id, direction, message_type, body,
        media_url, media_mime_type, media_filename, status, metadata, timestamp)
       VALUES ($1, $2, $3, 'outbound', $4, $5, $6, $7, $8, $9, $10, NOW())
       RETURNING *`,
      [
        tenantId, conversationId, data.wa_message_id || null, data.message_type || 'text',
        data.body || null, data.media_url || null, data.media_mime_type || null,
        data.media_filename || null, data.status || 'queued',
        JSON.stringify(data.metadata || {}),
      ]
    );
    return result.rows[0];
  }

  static async updateStatus(waMessageId: string, status: string, errorMessage?: string) {
    await query(
      `UPDATE wa_chat_messages SET status = $2, error_message = $3 WHERE wa_message_id = $1`,
      [waMessageId, status, errorMessage || null]
    );
  }
}

// ── 24-Hour Window Management ────────────────────────────────────

export class WaChatWindowService {
  static async createWindow(tenantId: string, conversationId: string, waId: string) {
    const windowStart = new Date();
    const windowEnd = new Date(windowStart.getTime() + 24 * 60 * 60 * 1000); // 24 hours

    const result = await query(
      `INSERT INTO wa_chat_conversation_windows (tenant_id, conversation_id, wa_id, window_start, window_end)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (conversation_id, window_start) DO NOTHING
       RETURNING *`,
      [tenantId, conversationId, waId, windowStart, windowEnd]
    );
    return result.rows[0];
  }

  static async getActiveWindow(conversationId: string) {
    const result = await query(
      `SELECT * FROM wa_chat_conversation_windows 
       WHERE conversation_id = $1 AND is_active = true AND window_end > NOW()
       ORDER BY window_start DESC LIMIT 1`,
      [conversationId]
    );
    return result.rows[0] || null;
  }

  static async getWindowTimeRemaining(conversationId: string): Promise<number> {
    const window = await WaChatWindowService.getActiveWindow(conversationId);
    if (!window) return 0;
    
    const now = new Date();
    const windowEnd = new Date(window.window_end);
    const remaining = windowEnd.getTime() - now.getTime();
    return Math.max(0, remaining);
  }

  static async canSendMessage(conversationId: string): Promise<{ canSend: boolean; timeRemaining: number }> {
    const timeRemaining = await WaChatWindowService.getWindowTimeRemaining(conversationId);
    return {
      canSend: timeRemaining > 0,
      timeRemaining
    };
  }

  static async expireWindow(conversationId: string) {
    await query(
      `UPDATE wa_chat_conversation_windows SET is_active = false WHERE conversation_id = $1 AND is_active = true`,
      [conversationId]
    );
  }
}

// ── Send via Meta Graph API ──────────────────────────────────────

export class WaChatSendService {
  static async sendText(tenantId: string, conversationId: string, waId: string, text: string) {
    const creds = await WaChatCredentialService.get(tenantId);
    if (!creds) throw new Error('WhatsApp credentials not configured');

    const msg = await WaChatMessageService.storeOutbound(tenantId, conversationId, {
      message_type: 'text',
      body: text,
      status: 'queued',
    });

    try {
      const res = await fetch(`${GRAPH_API}/${creds.phone_number_id}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${creds.access_token}`,
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: waId,
          type: 'text',
          text: { body: text },
        }),
        signal: AbortSignal.timeout(15000),
      });

      if (!res.ok) {
        const errBody = await res.text();
        const errMsg = `Meta API ${res.status}: ${errBody.slice(0, 200)}`;
        await WaChatMessageService.updateStatus(msg.id, 'failed', errMsg);
        throw new Error(errMsg);
      }

      const data = (await res.json()) as { messages?: Array<{ id: string }> };
      const waMessageId = data.messages?.[0]?.id;
      if (waMessageId) {
        await query(
          `UPDATE wa_chat_messages SET wa_message_id = $1, status = 'sent' WHERE id = $2`,
          [waMessageId, msg.id]
        );
      }

      // Update conversation
      await query(
        `UPDATE wa_chat_conversations SET last_message_text = $1, last_message_at = NOW(), updated_at = NOW() WHERE id = $2`,
        [text.slice(0, 200), conversationId]
      );

      publishEvent('wa_chat:message_sent', { tenant_id: tenantId, conversation_id: conversationId, message_id: msg.id });
      return { ...msg, wa_message_id: waMessageId, status: 'sent' };
    } catch (err) {
      log.error('sendText failed', { error: String(err) });
      throw err;
    }
  }

  static async sendMedia(tenantId: string, conversationId: string, waId: string, data: {
    type: 'image' | 'document' | 'video' | 'audio';
    url: string;
    caption?: string;
    filename?: string;
    mime_type?: string;
  }) {
    const creds = await WaChatCredentialService.get(tenantId);
    if (!creds) throw new Error('WhatsApp credentials not configured');

    const msg = await WaChatMessageService.storeOutbound(tenantId, conversationId, {
      message_type: data.type,
      media_url: data.url,
      media_mime_type: data.mime_type,
      media_filename: data.filename,
      body: data.caption,
      status: 'queued',
    });

    try {
      const mediaPayload: Record<string, unknown> = { link: data.url };
      if (data.caption) mediaPayload.caption = data.caption;
      if (data.filename) mediaPayload.filename = data.filename;

      const res = await fetch(`${GRAPH_API}/${creds.phone_number_id}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${creds.access_token}`,
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: waId,
          type: data.type,
          [data.type]: mediaPayload,
        }),
        signal: AbortSignal.timeout(15000),
      });

      if (!res.ok) {
        const errBody = await res.text();
        const errMsg = `Meta API ${res.status}: ${errBody.slice(0, 200)}`;
        await WaChatMessageService.updateStatus(msg.id, 'failed', errMsg);
        throw new Error(errMsg);
      }

      const resData = (await res.json()) as { messages?: Array<{ id: string }> };
      const waMessageId = resData.messages?.[0]?.id;
      if (waMessageId) {
        await query(
          `UPDATE wa_chat_messages SET wa_message_id = $1, status = 'sent' WHERE id = $2`,
          [waMessageId, msg.id]
        );
      }

      await query(
        `UPDATE wa_chat_conversations SET last_message_text = $1, last_message_at = NOW(), updated_at = NOW() WHERE id = $2`,
        [`[${data.type}]${data.caption ? ` ${data.caption.slice(0, 100)}` : ''}`, conversationId]
      );

      publishEvent('wa_chat:message_sent', { tenant_id: tenantId, conversation_id: conversationId, message_id: msg.id });
      return { ...msg, wa_message_id: waMessageId, status: 'sent' };
    } catch (err) {
      log.error('sendMedia failed', { error: String(err) });
      throw err;
    }
  }
}
