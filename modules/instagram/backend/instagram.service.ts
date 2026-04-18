/**
 * Instagram service — accounts, DMs, comments, comment rules, story rules,
 * lead bot, content studio, automation logs, Graph API integration.
 */
import { query } from '../../../packages/db/src/connection';
import { redisPub, isRedisAvailable } from '../../../packages/db/src/redis';
import { createLogger } from '../../../packages/utils/src/logger';
import type {
  InstagramAccount, InstagramMessage, InstagramComment,
  InstagramCommentRule, InstagramStoryRule,
  InstagramLeadBotConfig, InstagramLead,
  InstagramContent, InstagramAutomationLog,
} from './Instagram';

const log = createLogger('service:instagram');

function publish(channel: string, data: unknown) {
  if (isRedisAvailable()) redisPub.publish(channel, JSON.stringify(data));
}

// ══════════════════════════════════════════════════════════════════════════════
//  ACCOUNTS
// ══════════════════════════════════════════════════════════════════════════════

export class InstagramAccountService {
  static async connect(tenantId: string, data: {
    ig_user_id: string; ig_username: string; access_token: string;
    token_expires_at?: string; page_id?: string; page_access_token?: string;
    profile_pic_url?: string; metadata?: Record<string, unknown>;
  }): Promise<InstagramAccount> {
    const res = await query<InstagramAccount>(
      `INSERT INTO instagram_accounts (tenant_id, ig_user_id, ig_username, access_token,
         token_expires_at, page_id, page_access_token, profile_pic_url, metadata)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb)
       ON CONFLICT (tenant_id, ig_user_id) DO UPDATE SET
         ig_username = EXCLUDED.ig_username, access_token = EXCLUDED.access_token,
         token_expires_at = EXCLUDED.token_expires_at, page_id = EXCLUDED.page_id,
         page_access_token = EXCLUDED.page_access_token, profile_pic_url = EXCLUDED.profile_pic_url,
         is_active = true, updated_at = NOW()
       RETURNING *`,
      [tenantId, data.ig_user_id, data.ig_username, data.access_token,
       data.token_expires_at ?? null, data.page_id ?? null, data.page_access_token ?? null,
       data.profile_pic_url ?? null, JSON.stringify(data.metadata ?? {})]
    );
    return res.rows[0];
  }

  static async list(tenantId: string): Promise<InstagramAccount[]> {
    const res = await query<InstagramAccount>(
      'SELECT * FROM instagram_accounts WHERE tenant_id = $1 ORDER BY created_at DESC', [tenantId]
    );
    return res.rows;
  }

  static async getById(id: string): Promise<InstagramAccount | null> {
    const res = await query<InstagramAccount>('SELECT * FROM instagram_accounts WHERE id = $1', [id]);
    return res.rows[0] ?? null;
  }

  static async update(id: string, data: Record<string, unknown>): Promise<InstagramAccount | null> {
    const sets: string[] = []; const params: unknown[] = [];
    const fields: Record<string, string> = {
      accessToken: 'access_token', tokenExpiresAt: 'token_expires_at',
      pageAccessToken: 'page_access_token', profilePicUrl: 'profile_pic_url',
      isActive: 'is_active', metadata: 'metadata',
    };
    for (const [k, col] of Object.entries(fields)) {
      if (data[k] !== undefined) {
        params.push(k === 'metadata' ? JSON.stringify(data[k]) : data[k]);
        sets.push(`${col} = $${params.length}${k === 'metadata' ? '::jsonb' : ''}`);
      }
    }
    if (!sets.length) return this.getById(id);
    sets.push('updated_at = NOW()');
    params.push(id);
    const res = await query<InstagramAccount>(
      `UPDATE instagram_accounts SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING *`, params
    );
    return res.rows[0] ?? null;
  }

  static async delete(id: string): Promise<boolean> {
    const res = await query('DELETE FROM instagram_accounts WHERE id = $1', [id]);
    return (res.rowCount ?? 0) > 0;
  }

  static async getByIgUserId(tenantId: string, igUserId: string): Promise<InstagramAccount | null> {
    const res = await query<InstagramAccount>(
      'SELECT * FROM instagram_accounts WHERE tenant_id = $1 AND ig_user_id = $2', [tenantId, igUserId]
    );
    return res.rows[0] ?? null;
  }
}

// ══════════════════════════════════════════════════════════════════════════════
//  MESSAGES (DM Inbox)
// ══════════════════════════════════════════════════════════════════════════════

export class InstagramMessageService {
  static async create(data: {
    tenant_id: string; account_id: string; ig_message_id?: string; ig_conversation_id?: string;
    sender_id: string; sender_username?: string; recipient_id: string;
    direction: 'inbound' | 'outbound'; message_type?: string;
    body?: string; media_url?: string; ig_post_id?: string;
    status?: string; rule_id?: string; is_automated?: boolean;
    metadata?: Record<string, unknown>;
  }): Promise<InstagramMessage> {
    const res = await query<InstagramMessage>(
      `INSERT INTO instagram_messages (tenant_id, account_id, ig_message_id, ig_conversation_id,
         sender_id, sender_username, recipient_id, direction, message_type,
         body, media_url, ig_post_id, status, rule_id, is_automated, metadata)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16::jsonb) RETURNING *`,
      [data.tenant_id, data.account_id, data.ig_message_id ?? null, data.ig_conversation_id ?? null,
       data.sender_id, data.sender_username ?? null, data.recipient_id,
       data.direction, data.message_type ?? 'text',
       data.body ?? null, data.media_url ?? null, data.ig_post_id ?? null,
       data.status ?? (data.direction === 'inbound' ? 'received' : 'sent'),
       data.rule_id ?? null, data.is_automated ?? false,
       JSON.stringify(data.metadata ?? {})]
    );
    const msg = res.rows[0];
    if (msg.direction === 'inbound') {
      publish('instagram:dm_received', { tenantId: data.tenant_id, messageId: msg.id, senderId: data.sender_id });
    }
    return msg;
  }

  static async listConversations(tenantId: string, accountId: string, opts?: {
    limit?: number; offset?: number; search?: string;
  }): Promise<{ conversations: Array<{ sender_id: string; sender_username: string | null; last_message: string | null; last_at: string; unread: number }>; total: number }> {
    const conds = ['m.tenant_id = $1', 'm.account_id = $2'];
    const params: unknown[] = [tenantId, accountId];
    if (opts?.search) { params.push(`%${opts.search}%`); conds.push(`(m.sender_username ILIKE $${params.length} OR m.body ILIKE $${params.length})`); }
    const where = conds.join(' AND ');
    params.push(opts?.limit ?? 50, opts?.offset ?? 0);
    const rows = await query<{ sender_id: string; sender_username: string | null; last_message: string | null; last_at: string; unread: string }>(
      `SELECT m.sender_id, m.sender_username,
              (SELECT body FROM instagram_messages WHERE sender_id = m.sender_id AND account_id = m.account_id ORDER BY created_at DESC LIMIT 1) AS last_message,
              MAX(m.created_at) AS last_at,
              COUNT(*) FILTER (WHERE m.status = 'received' AND m.direction = 'inbound') AS unread
       FROM instagram_messages m WHERE ${where} AND m.direction = 'inbound'
       GROUP BY m.sender_id, m.sender_username
       ORDER BY last_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`, params
    );
    const cnt = await query<{ count: string }>(
      `SELECT COUNT(DISTINCT sender_id) AS count FROM instagram_messages WHERE ${conds.join(' AND ')}`,
      params.slice(0, conds.length)
    );
    return {
      conversations: rows.rows.map(r => ({ ...r, unread: parseInt(r.unread) })),
      total: parseInt(cnt.rows[0]?.count ?? '0'),
    };
  }

  static async getConversation(accountId: string, senderId: string, opts?: {
    limit?: number; offset?: number;
  }): Promise<InstagramMessage[]> {
    const res = await query<InstagramMessage>(
      `SELECT * FROM instagram_messages
       WHERE account_id = $1 AND (sender_id = $2 OR recipient_id = $2)
       ORDER BY created_at ASC LIMIT $3 OFFSET $4`,
      [accountId, senderId, opts?.limit ?? 100, opts?.offset ?? 0]
    );
    return res.rows;
  }

  static async markRead(accountId: string, senderId: string): Promise<void> {
    await query(
      `UPDATE instagram_messages SET status = 'read'
       WHERE account_id = $1 AND sender_id = $2 AND direction = 'inbound' AND status = 'received'`,
      [accountId, senderId]
    );
  }
}

// ══════════════════════════════════════════════════════════════════════════════
//  COMMENTS
// ══════════════════════════════════════════════════════════════════════════════

export class InstagramCommentService {
  static async upsert(data: {
    tenant_id: string; account_id: string; ig_comment_id: string; ig_media_id: string;
    ig_user_id: string; username?: string; text: string; parent_id?: string;
    timestamp: string; metadata?: Record<string, unknown>;
  }): Promise<InstagramComment> {
    const res = await query<InstagramComment>(
      `INSERT INTO instagram_comments (tenant_id, account_id, ig_comment_id, ig_media_id,
         ig_user_id, username, text, parent_id, timestamp, metadata)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb)
       ON CONFLICT (tenant_id, ig_comment_id) DO UPDATE SET
         text = EXCLUDED.text, username = EXCLUDED.username
       RETURNING *`,
      [data.tenant_id, data.account_id, data.ig_comment_id, data.ig_media_id,
       data.ig_user_id, data.username ?? null, data.text, data.parent_id ?? null,
       data.timestamp, JSON.stringify(data.metadata ?? {})]
    );
    publish('instagram:comment_received', { tenantId: data.tenant_id, commentId: res.rows[0].id, igMediaId: data.ig_media_id });
    return res.rows[0];
  }

  static async list(tenantId: string, opts?: {
    accountId?: string; igMediaId?: string; limit?: number; offset?: number;
  }): Promise<{ comments: InstagramComment[]; total: number }> {
    const conds = ['tenant_id = $1'];
    const params: unknown[] = [tenantId];
    if (opts?.accountId) { params.push(opts.accountId); conds.push(`account_id = $${params.length}`); }
    if (opts?.igMediaId) { params.push(opts.igMediaId); conds.push(`ig_media_id = $${params.length}`); }
    const where = conds.join(' AND ');
    params.push(opts?.limit ?? 100, opts?.offset ?? 0);
    const [rows, cnt] = await Promise.all([
      query<InstagramComment>(`SELECT * FROM instagram_comments WHERE ${where} ORDER BY timestamp DESC LIMIT $${params.length - 1} OFFSET $${params.length}`, params),
      query<{ count: string }>(`SELECT COUNT(*) AS count FROM instagram_comments WHERE ${where}`, params.slice(0, -2)),
    ]);
    return { comments: rows.rows, total: parseInt(cnt.rows[0]?.count ?? '0') };
  }

  static async markDmSent(commentId: string, ruleId: string): Promise<void> {
    await query('UPDATE instagram_comments SET dm_sent = true, rule_id = $2 WHERE id = $1', [commentId, ruleId]);
  }
}

// ══════════════════════════════════════════════════════════════════════════════
//  COMMENT-TO-DM RULES
// ══════════════════════════════════════════════════════════════════════════════

export class InstagramCommentRuleService {
  static async create(tenantId: string, data: Record<string, unknown>): Promise<InstagramCommentRule> {
    const res = await query<InstagramCommentRule>(
      `INSERT INTO instagram_comment_rules (tenant_id, account_id, name, ig_media_id, ig_media_url,
         keywords, match_type, dm_template, dm_template_b, ab_split,
         delay_min_sec, delay_max_sec, enable_tracking, auto_tag, is_active, metadata)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16::jsonb) RETURNING *`,
      [tenantId, data.accountId, data.name, data.igMediaId ?? null, data.igMediaUrl ?? null,
       data.keywords, data.matchType ?? 'any', data.dmTemplate, data.dmTemplateB ?? null,
       data.abSplit ?? 100, data.delayMinSec ?? 0, data.delayMaxSec ?? 0,
       data.enableTracking ?? true, data.autoTag ?? [],
       data.isActive ?? true, JSON.stringify(data.metadata ?? {})]
    );
    return res.rows[0];
  }

  static async list(tenantId: string, opts?: { accountId?: string; isActive?: boolean }): Promise<InstagramCommentRule[]> {
    const conds = ['tenant_id = $1'];
    const params: unknown[] = [tenantId];
    if (opts?.accountId) { params.push(opts.accountId); conds.push(`account_id = $${params.length}`); }
    if (opts?.isActive !== undefined) { params.push(opts.isActive); conds.push(`is_active = $${params.length}`); }
    const res = await query<InstagramCommentRule>(
      `SELECT * FROM instagram_comment_rules WHERE ${conds.join(' AND ')} ORDER BY created_at DESC`, params
    );
    return res.rows;
  }

  static async getById(id: string): Promise<InstagramCommentRule | null> {
    const res = await query<InstagramCommentRule>('SELECT * FROM instagram_comment_rules WHERE id = $1', [id]);
    return res.rows[0] ?? null;
  }

  static async update(id: string, data: Record<string, unknown>): Promise<InstagramCommentRule | null> {
    const fieldMap: Record<string, string> = {
      name: 'name', igMediaId: 'ig_media_id', igMediaUrl: 'ig_media_url',
      keywords: 'keywords', matchType: 'match_type', dmTemplate: 'dm_template',
      dmTemplateB: 'dm_template_b', abSplit: 'ab_split', delayMinSec: 'delay_min_sec',
      delayMaxSec: 'delay_max_sec', enableTracking: 'enable_tracking', autoTag: 'auto_tag',
      isActive: 'is_active', metadata: 'metadata',
    };
    const sets: string[] = []; const params: unknown[] = [];
    for (const [k, col] of Object.entries(fieldMap)) {
      if (data[k] !== undefined) {
        params.push(k === 'metadata' ? JSON.stringify(data[k]) : data[k]);
        sets.push(`${col} = $${params.length}${k === 'metadata' ? '::jsonb' : ''}`);
      }
    }
    if (!sets.length) return this.getById(id);
    sets.push('updated_at = NOW()');
    params.push(id);
    const res = await query<InstagramCommentRule>(
      `UPDATE instagram_comment_rules SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING *`, params
    );
    return res.rows[0] ?? null;
  }

  static async delete(id: string): Promise<boolean> {
    const res = await query('DELETE FROM instagram_comment_rules WHERE id = $1', [id]);
    return (res.rowCount ?? 0) > 0;
  }

  static async incrementTrigger(id: string): Promise<void> {
    await query(
      'UPDATE instagram_comment_rules SET trigger_count = trigger_count + 1, last_triggered_at = NOW() WHERE id = $1', [id]
    );
  }

  static async incrementDmSent(id: string): Promise<void> {
    await query('UPDATE instagram_comment_rules SET dm_sent_count = dm_sent_count + 1 WHERE id = $1', [id]);
  }

  static async incrementClick(id: string): Promise<void> {
    await query('UPDATE instagram_comment_rules SET click_count = click_count + 1 WHERE id = $1', [id]);
  }

  static async getActiveRulesForMedia(tenantId: string, igMediaId: string): Promise<InstagramCommentRule[]> {
    const res = await query<InstagramCommentRule>(
      `SELECT * FROM instagram_comment_rules
       WHERE tenant_id = $1 AND is_active = true AND (ig_media_id = $2 OR ig_media_id IS NULL)
       ORDER BY created_at ASC`, [tenantId, igMediaId]
    );
    return res.rows;
  }
}

// ══════════════════════════════════════════════════════════════════════════════
//  STORY RULES
// ══════════════════════════════════════════════════════════════════════════════

export class InstagramStoryRuleService {
  static async create(tenantId: string, data: Record<string, unknown>): Promise<InstagramStoryRule> {
    const res = await query<InstagramStoryRule>(
      `INSERT INTO instagram_story_rules (tenant_id, account_id, name, trigger_type,
         keywords, match_type, dm_template, dm_template_b, ab_split,
         delay_min_sec, delay_max_sec, followup_template, followup_delay_sec,
         auto_tag, is_active, metadata)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16::jsonb) RETURNING *`,
      [tenantId, data.accountId, data.name, data.triggerType ?? 'story_reply',
       data.keywords ?? [], data.matchType ?? 'any', data.dmTemplate,
       data.dmTemplateB ?? null, data.abSplit ?? 100,
       data.delayMinSec ?? 0, data.delayMaxSec ?? 0,
       data.followupTemplate ?? null, data.followupDelaySec ?? 0,
       data.autoTag ?? [], data.isActive ?? true,
       JSON.stringify(data.metadata ?? {})]
    );
    return res.rows[0];
  }

  static async list(tenantId: string, opts?: { accountId?: string; isActive?: boolean }): Promise<InstagramStoryRule[]> {
    const conds = ['tenant_id = $1'];
    const params: unknown[] = [tenantId];
    if (opts?.accountId) { params.push(opts.accountId); conds.push(`account_id = $${params.length}`); }
    if (opts?.isActive !== undefined) { params.push(opts.isActive); conds.push(`is_active = $${params.length}`); }
    const res = await query<InstagramStoryRule>(
      `SELECT * FROM instagram_story_rules WHERE ${conds.join(' AND ')} ORDER BY created_at DESC`, params
    );
    return res.rows;
  }

  static async getById(id: string): Promise<InstagramStoryRule | null> {
    const res = await query<InstagramStoryRule>('SELECT * FROM instagram_story_rules WHERE id = $1', [id]);
    return res.rows[0] ?? null;
  }

  static async update(id: string, data: Record<string, unknown>): Promise<InstagramStoryRule | null> {
    const fieldMap: Record<string, string> = {
      name: 'name', triggerType: 'trigger_type', keywords: 'keywords',
      matchType: 'match_type', dmTemplate: 'dm_template', dmTemplateB: 'dm_template_b',
      abSplit: 'ab_split', delayMinSec: 'delay_min_sec', delayMaxSec: 'delay_max_sec',
      followupTemplate: 'followup_template', followupDelaySec: 'followup_delay_sec',
      autoTag: 'auto_tag', isActive: 'is_active', metadata: 'metadata',
    };
    const sets: string[] = []; const params: unknown[] = [];
    for (const [k, col] of Object.entries(fieldMap)) {
      if (data[k] !== undefined) {
        params.push(k === 'metadata' ? JSON.stringify(data[k]) : data[k]);
        sets.push(`${col} = $${params.length}${k === 'metadata' ? '::jsonb' : ''}`);
      }
    }
    if (!sets.length) return this.getById(id);
    sets.push('updated_at = NOW()');
    params.push(id);
    const res = await query<InstagramStoryRule>(
      `UPDATE instagram_story_rules SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING *`, params
    );
    return res.rows[0] ?? null;
  }

  static async delete(id: string): Promise<boolean> {
    const res = await query('DELETE FROM instagram_story_rules WHERE id = $1', [id]);
    return (res.rowCount ?? 0) > 0;
  }

  static async getActiveRules(tenantId: string, triggerType: string): Promise<InstagramStoryRule[]> {
    const res = await query<InstagramStoryRule>(
      `SELECT * FROM instagram_story_rules
       WHERE tenant_id = $1 AND is_active = true AND trigger_type = $2
       ORDER BY created_at ASC`, [tenantId, triggerType]
    );
    return res.rows;
  }
}

// ══════════════════════════════════════════════════════════════════════════════
//  LEAD BOT CONFIG
// ══════════════════════════════════════════════════════════════════════════════

export class InstagramLeadBotService {
  static async create(tenantId: string, data: Record<string, unknown>): Promise<InstagramLeadBotConfig> {
    const res = await query<InstagramLeadBotConfig>(
      `INSERT INTO instagram_lead_bot_configs (tenant_id, account_id, name, steps,
         welcome_message, completion_message, scoring_rules, auto_assign_to,
         send_to_whatsapp, whatsapp_number, google_sheet_id, google_sheet_tab,
         recovery_message, recovery_delay_hours, is_active, metadata)
       VALUES ($1,$2,$3,$4::jsonb,$5,$6,$7::jsonb,$8,$9,$10,$11,$12,$13,$14,$15,$16::jsonb) RETURNING *`,
      [tenantId, data.accountId, data.name, JSON.stringify(data.steps),
       data.welcomeMessage ?? 'Hi! Let me help you get started.',
       data.completionMessage ?? null, JSON.stringify(data.scoringRules ?? {}),
       data.autoAssignTo ?? null, data.sendToWhatsapp ?? false,
       data.whatsappNumber ?? null, data.googleSheetId ?? null, data.googleSheetTab ?? null,
       data.recoveryMessage ?? null, data.recoveryDelayHours ?? 24,
       data.isActive ?? true, JSON.stringify(data.metadata ?? {})]
    );
    return res.rows[0];
  }

  static async list(tenantId: string, opts?: { accountId?: string }): Promise<InstagramLeadBotConfig[]> {
    const conds = ['tenant_id = $1'];
    const params: unknown[] = [tenantId];
    if (opts?.accountId) { params.push(opts.accountId); conds.push(`account_id = $${params.length}`); }
    const res = await query<InstagramLeadBotConfig>(
      `SELECT * FROM instagram_lead_bot_configs WHERE ${conds.join(' AND ')} ORDER BY created_at DESC`, params
    );
    return res.rows;
  }

  static async getById(id: string): Promise<InstagramLeadBotConfig | null> {
    const res = await query<InstagramLeadBotConfig>('SELECT * FROM instagram_lead_bot_configs WHERE id = $1', [id]);
    return res.rows[0] ?? null;
  }

  static async update(id: string, data: Record<string, unknown>): Promise<InstagramLeadBotConfig | null> {
    const fieldMap: Record<string, string> = {
      name: 'name', welcomeMessage: 'welcome_message', completionMessage: 'completion_message',
      autoAssignTo: 'auto_assign_to', sendToWhatsapp: 'send_to_whatsapp',
      whatsappNumber: 'whatsapp_number', googleSheetId: 'google_sheet_id',
      googleSheetTab: 'google_sheet_tab', recoveryMessage: 'recovery_message',
      recoveryDelayHours: 'recovery_delay_hours', isActive: 'is_active',
    };
    const jsonFields = ['steps', 'scoringRules', 'metadata'];
    const jsonColMap: Record<string, string> = { steps: 'steps', scoringRules: 'scoring_rules', metadata: 'metadata' };
    const sets: string[] = []; const params: unknown[] = [];
    for (const [k, col] of Object.entries(fieldMap)) {
      if (data[k] !== undefined) { params.push(data[k]); sets.push(`${col} = $${params.length}`); }
    }
    for (const k of jsonFields) {
      if (data[k] !== undefined) { params.push(JSON.stringify(data[k])); sets.push(`${jsonColMap[k]} = $${params.length}::jsonb`); }
    }
    if (!sets.length) return this.getById(id);
    sets.push('updated_at = NOW()');
    params.push(id);
    const res = await query<InstagramLeadBotConfig>(
      `UPDATE instagram_lead_bot_configs SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING *`, params
    );
    return res.rows[0] ?? null;
  }

  static async delete(id: string): Promise<boolean> {
    const res = await query('DELETE FROM instagram_lead_bot_configs WHERE id = $1', [id]);
    return (res.rowCount ?? 0) > 0;
  }

  static async getActiveForAccount(accountId: string): Promise<InstagramLeadBotConfig | null> {
    const res = await query<InstagramLeadBotConfig>(
      'SELECT * FROM instagram_lead_bot_configs WHERE account_id = $1 AND is_active = true LIMIT 1', [accountId]
    );
    return res.rows[0] ?? null;
  }
}

// ══════════════════════════════════════════════════════════════════════════════
//  LEADS
// ══════════════════════════════════════════════════════════════════════════════

export class InstagramLeadService {
  static async upsert(data: {
    tenant_id: string; account_id: string; bot_config_id?: string;
    ig_user_id: string; ig_username?: string;
  }): Promise<InstagramLead> {
    const existing = await query<InstagramLead>(
      'SELECT * FROM instagram_leads WHERE account_id = $1 AND ig_user_id = $2 AND status = \'in_progress\' LIMIT 1',
      [data.account_id, data.ig_user_id]
    );
    if (existing.rows[0]) return existing.rows[0];
    const res = await query<InstagramLead>(
      `INSERT INTO instagram_leads (tenant_id, account_id, bot_config_id, ig_user_id, ig_username)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [data.tenant_id, data.account_id, data.bot_config_id ?? null,
       data.ig_user_id, data.ig_username ?? null]
    );
    return res.rows[0];
  }

  static async updateStep(id: string, step: number, field: string, value: unknown, score?: number): Promise<InstagramLead | null> {
    const sets = ['current_step = $2', `answers = answers || $3::jsonb`, 'updated_at = NOW()'];
    const params: unknown[] = [id, step, JSON.stringify({ [field]: value })];
    if (score !== undefined) { params.push(score); sets.push(`score = score + $${params.length}`); }
    const res = await query<InstagramLead>(
      `UPDATE instagram_leads SET ${sets.join(', ')} WHERE id = $1 RETURNING *`, params
    );
    return res.rows[0] ?? null;
  }

  static async complete(id: string, segment: string): Promise<InstagramLead | null> {
    const res = await query<InstagramLead>(
      `UPDATE instagram_leads SET status = 'completed', segment = $2, completed_at = NOW(), updated_at = NOW()
       WHERE id = $1 RETURNING *`, [id, segment]
    );
    if (res.rows[0]) {
      publish('instagram:hot_lead', { tenantId: res.rows[0].tenant_id, leadId: id, segment });
    }
    return res.rows[0] ?? null;
  }

  static async list(tenantId: string, opts?: {
    accountId?: string; status?: string; segment?: string; limit?: number; offset?: number;
  }): Promise<{ leads: InstagramLead[]; total: number }> {
    const conds = ['tenant_id = $1'];
    const params: unknown[] = [tenantId];
    if (opts?.accountId) { params.push(opts.accountId); conds.push(`account_id = $${params.length}`); }
    if (opts?.status) { params.push(opts.status); conds.push(`status = $${params.length}`); }
    if (opts?.segment) { params.push(opts.segment); conds.push(`segment = $${params.length}`); }
    const where = conds.join(' AND ');
    params.push(opts?.limit ?? 50, opts?.offset ?? 0);
    const [rows, cnt] = await Promise.all([
      query<InstagramLead>(`SELECT * FROM instagram_leads WHERE ${where} ORDER BY created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`, params),
      query<{ count: string }>(`SELECT COUNT(*) AS count FROM instagram_leads WHERE ${where}`, params.slice(0, -2)),
    ]);
    return { leads: rows.rows, total: parseInt(cnt.rows[0]?.count ?? '0') };
  }

  static async getById(id: string): Promise<InstagramLead | null> {
    const res = await query<InstagramLead>('SELECT * FROM instagram_leads WHERE id = $1', [id]);
    return res.rows[0] ?? null;
  }

  static async getDropped(tenantId: string, hoursAgo: number): Promise<InstagramLead[]> {
    const res = await query<InstagramLead>(
      `SELECT * FROM instagram_leads
       WHERE tenant_id = $1 AND status = 'in_progress'
         AND updated_at < NOW() - INTERVAL '1 hour' * $2
       ORDER BY updated_at ASC LIMIT 100`, [tenantId, hoursAgo]
    );
    return res.rows;
  }

  static async markDropped(id: string): Promise<void> {
    await query(`UPDATE instagram_leads SET status = 'dropped', updated_at = NOW() WHERE id = $1`, [id]);
  }

  static async markRecovered(id: string): Promise<void> {
    await query(`UPDATE instagram_leads SET status = 'recovered', recovered_at = NOW(), updated_at = NOW() WHERE id = $1`, [id]);
  }

  static async markSentToWhatsapp(id: string): Promise<void> {
    await query('UPDATE instagram_leads SET sent_to_whatsapp = true WHERE id = $1', [id]);
  }

  static async markSentToSheets(id: string): Promise<void> {
    await query('UPDATE instagram_leads SET sent_to_sheets = true WHERE id = $1', [id]);
  }
}

// ══════════════════════════════════════════════════════════════════════════════
//  CONTENT STUDIO
// ══════════════════════════════════════════════════════════════════════════════

export class InstagramContentService {
  static async create(tenantId: string, data: Record<string, unknown>): Promise<InstagramContent> {
    const res = await query<InstagramContent>(
      `INSERT INTO instagram_content (tenant_id, account_id, content_type, caption,
         hashtags, media_urls, thumbnail_url, scheduled_at, platforms, metadata)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb) RETURNING *`,
      [tenantId, data.accountId, data.contentType ?? 'post', data.caption ?? null,
       data.hashtags ?? [], data.mediaUrls ?? [], data.thumbnailUrl ?? null,
       data.scheduledAt ?? null, data.platforms ?? ['instagram'],
       JSON.stringify(data.metadata ?? {})]
    );
    return res.rows[0];
  }

  static async list(tenantId: string, opts?: {
    accountId?: string; status?: string; contentType?: string; limit?: number; offset?: number;
  }): Promise<{ content: InstagramContent[]; total: number }> {
    const conds = ['tenant_id = $1'];
    const params: unknown[] = [tenantId];
    if (opts?.accountId) { params.push(opts.accountId); conds.push(`account_id = $${params.length}`); }
    if (opts?.status) { params.push(opts.status); conds.push(`status = $${params.length}`); }
    if (opts?.contentType) { params.push(opts.contentType); conds.push(`content_type = $${params.length}`); }
    const where = conds.join(' AND ');
    params.push(opts?.limit ?? 50, opts?.offset ?? 0);
    const [rows, cnt] = await Promise.all([
      query<InstagramContent>(`SELECT * FROM instagram_content WHERE ${where} ORDER BY COALESCE(scheduled_at, created_at) DESC LIMIT $${params.length - 1} OFFSET $${params.length}`, params),
      query<{ count: string }>(`SELECT COUNT(*) AS count FROM instagram_content WHERE ${where}`, params.slice(0, -2)),
    ]);
    return { content: rows.rows, total: parseInt(cnt.rows[0]?.count ?? '0') };
  }

  static async getById(id: string): Promise<InstagramContent | null> {
    const res = await query<InstagramContent>('SELECT * FROM instagram_content WHERE id = $1', [id]);
    return res.rows[0] ?? null;
  }

  static async update(id: string, data: Record<string, unknown>): Promise<InstagramContent | null> {
    const fieldMap: Record<string, string> = {
      caption: 'caption', hashtags: 'hashtags', mediaUrls: 'media_urls',
      thumbnailUrl: 'thumbnail_url', scheduledAt: 'scheduled_at',
      status: 'status', platforms: 'platforms',
    };
    const sets: string[] = []; const params: unknown[] = [];
    for (const [k, col] of Object.entries(fieldMap)) {
      if (data[k] !== undefined) { params.push(data[k]); sets.push(`${col} = $${params.length}`); }
    }
    if (data.metadata !== undefined) {
      params.push(JSON.stringify(data.metadata)); sets.push(`metadata = $${params.length}::jsonb`);
    }
    if (!sets.length) return this.getById(id);
    sets.push('updated_at = NOW()');
    params.push(id);
    const res = await query<InstagramContent>(
      `UPDATE instagram_content SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING *`, params
    );
    return res.rows[0] ?? null;
  }

  static async delete(id: string): Promise<boolean> {
    const res = await query('DELETE FROM instagram_content WHERE id = $1', [id]);
    return (res.rowCount ?? 0) > 0;
  }

  static async getScheduled(): Promise<InstagramContent[]> {
    const res = await query<InstagramContent>(
      `SELECT * FROM instagram_content
       WHERE status = 'scheduled' AND scheduled_at <= NOW()
       ORDER BY scheduled_at ASC LIMIT 50`
    );
    return res.rows;
  }

  static async publish(id: string, igMediaId: string): Promise<InstagramContent | null> {
    const res = await query<InstagramContent>(
      `UPDATE instagram_content SET status = 'published', ig_media_id = $2, published_at = NOW(), updated_at = NOW()
       WHERE id = $1 RETURNING *`, [id, igMediaId]
    );
    if (res.rows[0]) {
      publish('instagram:content_published', { tenantId: res.rows[0].tenant_id, contentId: id });
    }
    return res.rows[0] ?? null;
  }

  static async fail(id: string, error: string): Promise<void> {
    await query(
      `UPDATE instagram_content SET status = 'failed', error_message = $2, updated_at = NOW() WHERE id = $1`,
      [id, error]
    );
  }

  static async updateEngagement(id: string, engagement: Record<string, number>): Promise<void> {
    await query(
      `UPDATE instagram_content SET engagement = $2::jsonb, updated_at = NOW() WHERE id = $1`,
      [id, JSON.stringify(engagement)]
    );
  }
}

// ══════════════════════════════════════════════════════════════════════════════
//  AUTOMATION LOGS
// ══════════════════════════════════════════════════════════════════════════════

export class InstagramLogService {
  static async log(data: {
    tenant_id: string; account_id?: string; log_type: string;
    rule_id?: string; lead_id?: string; content_id?: string;
    ig_user_id?: string; ig_username?: string;
    message?: string; status?: string; error_detail?: string;
    metadata?: Record<string, unknown>;
  }): Promise<InstagramAutomationLog> {
    const res = await query<InstagramAutomationLog>(
      `INSERT INTO instagram_automation_logs (tenant_id, account_id, log_type,
         rule_id, lead_id, content_id, ig_user_id, ig_username,
         message, status, error_detail, metadata)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb) RETURNING *`,
      [data.tenant_id, data.account_id ?? null, data.log_type,
       data.rule_id ?? null, data.lead_id ?? null, data.content_id ?? null,
       data.ig_user_id ?? null, data.ig_username ?? null,
       data.message ?? null, data.status ?? 'success', data.error_detail ?? null,
       JSON.stringify(data.metadata ?? {})]
    );
    return res.rows[0];
  }

  static async list(tenantId: string, opts?: {
    logType?: string; ruleId?: string; limit?: number; offset?: number;
  }): Promise<{ logs: InstagramAutomationLog[]; total: number }> {
    const conds = ['tenant_id = $1'];
    const params: unknown[] = [tenantId];
    if (opts?.logType) { params.push(opts.logType); conds.push(`log_type = $${params.length}`); }
    if (opts?.ruleId) { params.push(opts.ruleId); conds.push(`rule_id = $${params.length}`); }
    const where = conds.join(' AND ');
    params.push(opts?.limit ?? 100, opts?.offset ?? 0);
    const [rows, cnt] = await Promise.all([
      query<InstagramAutomationLog>(`SELECT * FROM instagram_automation_logs WHERE ${where} ORDER BY created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`, params),
      query<{ count: string }>(`SELECT COUNT(*) AS count FROM instagram_automation_logs WHERE ${where}`, params.slice(0, -2)),
    ]);
    return { logs: rows.rows, total: parseInt(cnt.rows[0]?.count ?? '0') };
  }
}

// ══════════════════════════════════════════════════════════════════════════════
//  STATS
// ══════════════════════════════════════════════════════════════════════════════

export class InstagramStatsService {
  static async getOverview(tenantId: string): Promise<Record<string, unknown>> {
    const [accounts, msgs, comments, leads, content, logs] = await Promise.all([
      query<{ count: string }>('SELECT COUNT(*) AS count FROM instagram_accounts WHERE tenant_id = $1 AND is_active = true', [tenantId]),
      query<{ total: string; inbound: string; outbound: string; automated: string }>(
        `SELECT COUNT(*) AS total,
                COUNT(*) FILTER (WHERE direction = 'inbound') AS inbound,
                COUNT(*) FILTER (WHERE direction = 'outbound') AS outbound,
                COUNT(*) FILTER (WHERE is_automated = true) AS automated
         FROM instagram_messages WHERE tenant_id = $1`, [tenantId]
      ),
      query<{ total: string; dm_triggered: string }>(
        `SELECT COUNT(*) AS total, COUNT(*) FILTER (WHERE dm_sent = true) AS dm_triggered
         FROM instagram_comments WHERE tenant_id = $1`, [tenantId]
      ),
      query<{ total: string; hot: string; warm: string; cold: string; completed: string; dropped: string }>(
        `SELECT COUNT(*) AS total,
                COUNT(*) FILTER (WHERE segment = 'hot') AS hot,
                COUNT(*) FILTER (WHERE segment = 'warm') AS warm,
                COUNT(*) FILTER (WHERE segment = 'cold') AS cold,
                COUNT(*) FILTER (WHERE status = 'completed') AS completed,
                COUNT(*) FILTER (WHERE status = 'dropped') AS dropped
         FROM instagram_leads WHERE tenant_id = $1`, [tenantId]
      ),
      query<{ total: string; published: string; scheduled: string; total_likes: string; total_comments: string; total_reach: string }>(
        `SELECT COUNT(*) AS total,
                COUNT(*) FILTER (WHERE status = 'published') AS published,
                COUNT(*) FILTER (WHERE status = 'scheduled') AS scheduled,
                COALESCE(SUM((engagement->>'likes')::int), 0) AS total_likes,
                COALESCE(SUM((engagement->>'comments')::int), 0) AS total_comments,
                COALESCE(SUM((engagement->>'reach')::int), 0) AS total_reach
         FROM instagram_content WHERE tenant_id = $1`, [tenantId]
      ),
      query<{ count: string; errors: string }>(
        `SELECT COUNT(*) AS count, COUNT(*) FILTER (WHERE status = 'failed') AS errors
         FROM instagram_automation_logs WHERE tenant_id = $1 AND created_at > NOW() - INTERVAL '24 hours'`,
        [tenantId]
      ),
    ]);

    const m = msgs.rows[0]; const c = comments.rows[0]; const l = leads.rows[0]; const ct = content.rows[0];
    return {
      accounts: parseInt(accounts.rows[0]?.count ?? '0'),
      messages: { total: parseInt(m?.total ?? '0'), inbound: parseInt(m?.inbound ?? '0'), outbound: parseInt(m?.outbound ?? '0'), automated: parseInt(m?.automated ?? '0') },
      comments: { total: parseInt(c?.total ?? '0'), dmTriggered: parseInt(c?.dm_triggered ?? '0') },
      leads: { total: parseInt(l?.total ?? '0'), hot: parseInt(l?.hot ?? '0'), warm: parseInt(l?.warm ?? '0'), cold: parseInt(l?.cold ?? '0'), completed: parseInt(l?.completed ?? '0'), dropped: parseInt(l?.dropped ?? '0') },
      content: { total: parseInt(ct?.total ?? '0'), published: parseInt(ct?.published ?? '0'), scheduled: parseInt(ct?.scheduled ?? '0'), totalLikes: parseInt(ct?.total_likes ?? '0'), totalComments: parseInt(ct?.total_comments ?? '0'), totalReach: parseInt(ct?.total_reach ?? '0') },
      automationLast24h: { actions: parseInt(logs.rows[0]?.count ?? '0'), errors: parseInt(logs.rows[0]?.errors ?? '0') },
    };
  }
}

// ══════════════════════════════════════════════════════════════════════════════
//  GRAPH API HELPERS
// ══════════════════════════════════════════════════════════════════════════════

export class InstagramGraphAPI {
  static async sendDM(accessToken: string, igUserId: string, recipientId: string, message: string): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      const resp = await fetch(`https://graph.facebook.com/v21.0/${igUserId}/messages`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipient: { id: recipientId }, message: { text: message } }),
      });
      const data = await resp.json() as Record<string, unknown>;
      if (!resp.ok) return { success: false, error: (data.error as Record<string, unknown>)?.message as string ?? 'API error' };
      return { success: true, messageId: data.message_id as string };
    } catch (err) {
      log.error('Instagram DM send failed', err);
      return { success: false, error: (err as Error).message };
    }
  }

  static async publishMedia(accessToken: string, igUserId: string, data: {
    imageUrl?: string; videoUrl?: string; caption?: string; mediaType?: string;
  }): Promise<{ success: boolean; igMediaId?: string; error?: string }> {
    try {
      // Step 1: Create media container
      const containerBody: Record<string, unknown> = { caption: data.caption };
      if (data.mediaType === 'reel' || data.videoUrl) {
        containerBody.video_url = data.videoUrl;
        containerBody.media_type = 'REELS';
      } else {
        containerBody.image_url = data.imageUrl;
      }
      const containerResp = await fetch(`https://graph.facebook.com/v21.0/${igUserId}/media`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(containerBody),
      });
      const containerData = await containerResp.json() as Record<string, unknown>;
      if (!containerResp.ok) return { success: false, error: (containerData.error as Record<string, unknown>)?.message as string ?? 'Container creation failed' };
      const creationId = containerData.id as string;

      // Step 2: Publish
      const pubResp = await fetch(`https://graph.facebook.com/v21.0/${igUserId}/media_publish`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ creation_id: creationId }),
      });
      const pubData = await pubResp.json() as Record<string, unknown>;
      if (!pubResp.ok) return { success: false, error: (pubData.error as Record<string, unknown>)?.message as string ?? 'Publish failed' };
      return { success: true, igMediaId: pubData.id as string };
    } catch (err) {
      log.error('Instagram media publish failed', err);
      return { success: false, error: (err as Error).message };
    }
  }

  static async getMediaInsights(accessToken: string, igMediaId: string): Promise<Record<string, number>> {
    try {
      const resp = await fetch(
        `https://graph.facebook.com/v21.0/${igMediaId}/insights?metric=likes,comments,shares,saved,reach,impressions`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      const data = await resp.json() as { data?: Array<{ name: string; values: Array<{ value: number }> }> };
      const insights: Record<string, number> = {};
      if (data.data) {
        for (const metric of data.data) {
          insights[metric.name] = metric.values?.[0]?.value ?? 0;
        }
      }
      return insights;
    } catch (err) {
      log.error('Failed to fetch media insights', err);
      return {};
    }
  }
}
