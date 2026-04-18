import { query } from '../../../packages/db/src/connection';
import { publishEvent } from '../../../packages/db/src/redis';
import { createLogger } from '../../../packages/utils/src/logger';
import { LeadsService } from '../../../modules/leads/backend/leads.service';
import type { AutomationRule, ScheduledCampaign } from './AutomationRule';

const log = createLogger('automation');

type Condition = { field: string; operator: string; value: unknown };
type RuleAction = { type: string; config: Record<string, unknown> };

function evalCondition(c: Condition, data: Record<string, unknown>): boolean {
  const val = data[c.field];
  switch (c.operator) {
    case 'equals': return val === c.value;
    case 'not_equals': return val !== c.value;
    case 'contains': return typeof val === 'string' && val.includes(c.value as string);
    case 'not_contains': return typeof val === 'string' && !val.includes(c.value as string);
    case 'in': return Array.isArray(c.value) && (c.value as unknown[]).includes(val);
    case 'not_in': return Array.isArray(c.value) && !(c.value as unknown[]).includes(val);
    default: return true;
  }
}

export class AutomationService {
  // ── Rule CRUD ──────────────────────────────────────────────────────────────

  static async createRule(data: {
    name: string; description?: string; channel: string; trigger_type: string;
    trigger_config?: Record<string, unknown>; conditions?: Condition[];
    actions: RuleAction[]; is_active?: boolean; priority?: number;
    tenant_id?: string;
  }): Promise<AutomationRule> {
    const result = await query<AutomationRule>(
      `INSERT INTO automation_rules (name, description, channel, trigger_type, trigger_config, conditions, actions, is_active, priority, tenant_id)
       VALUES ($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7::jsonb,$8,$9,$10) RETURNING *`,
      [data.name, data.description ?? null, data.channel, data.trigger_type,
       JSON.stringify(data.trigger_config ?? {}), JSON.stringify(data.conditions ?? []),
       JSON.stringify(data.actions), data.is_active ?? true, data.priority ?? 0,
       data.tenant_id ?? null]
    );
    return result.rows[0];
  }

  static async listRules(opts?: { channel?: string; trigger_type?: string; is_active?: boolean; tenant_id?: string }): Promise<AutomationRule[]> {
    const params: unknown[] = [];
    const conds: string[] = [];
    if (opts?.tenant_id) {
      params.push(opts.tenant_id); conds.push(`tenant_id = $${params.length}`);
    }
    if (opts?.channel && opts.channel !== 'all') {
      params.push(opts.channel); conds.push(`(channel = $${params.length} OR channel = 'all')`);
    }
    if (opts?.trigger_type) { params.push(opts.trigger_type); conds.push(`trigger_type = $${params.length}`); }
    if (opts?.is_active !== undefined) { params.push(opts.is_active); conds.push(`is_active = $${params.length}`); }
    const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
    const result = await query<AutomationRule>(
      `SELECT * FROM automation_rules ${where} ORDER BY is_active DESC, priority DESC, created_at DESC`,
      params
    );
    return result.rows;
  }

  static async getRule(id: string, tenantId?: string): Promise<AutomationRule | null> {
    const params: unknown[] = [id];
    let sql = 'SELECT * FROM automation_rules WHERE id = $1';
    if (tenantId) { params.push(tenantId); sql += ` AND tenant_id = $${params.length}`; }
    const result = await query<AutomationRule>(sql, params);
    return result.rows[0] ?? null;
  }

  static async updateRule(id: string, data: Partial<{
    name: string; description: string; channel: string; trigger_type: string;
    trigger_config: Record<string, unknown>; conditions: Condition[];
    actions: RuleAction[]; is_active: boolean; priority: number;
  }>): Promise<AutomationRule | null> {
    const sets: string[] = ['updated_at = NOW()'];
    const params: unknown[] = [];
    if (data.name !== undefined) { params.push(data.name); sets.push(`name = $${params.length}`); }
    if (data.description !== undefined) { params.push(data.description); sets.push(`description = $${params.length}`); }
    if (data.channel !== undefined) { params.push(data.channel); sets.push(`channel = $${params.length}`); }
    if (data.trigger_type !== undefined) { params.push(data.trigger_type); sets.push(`trigger_type = $${params.length}`); }
    if (data.trigger_config !== undefined) { params.push(JSON.stringify(data.trigger_config)); sets.push(`trigger_config = $${params.length}::jsonb`); }
    if (data.conditions !== undefined) { params.push(JSON.stringify(data.conditions)); sets.push(`conditions = $${params.length}::jsonb`); }
    if (data.actions !== undefined) { params.push(JSON.stringify(data.actions)); sets.push(`actions = $${params.length}::jsonb`); }
    if (data.is_active !== undefined) { params.push(data.is_active); sets.push(`is_active = $${params.length}`); }
    if (data.priority !== undefined) { params.push(data.priority); sets.push(`priority = $${params.length}`); }
    params.push(id);
    const result = await query<AutomationRule>(
      `UPDATE automation_rules SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING *`,
      params
    );
    return result.rows[0] ?? null;
  }

  static async deleteRule(id: string): Promise<boolean> {
    const result = await query('DELETE FROM automation_rules WHERE id = $1', [id]);
    return (result.rowCount ?? 0) > 0;
  }

  static async toggleRule(id: string): Promise<AutomationRule | null> {
    const result = await query<AutomationRule>(
      'UPDATE automation_rules SET is_active = NOT is_active, updated_at = NOW() WHERE id = $1 RETURNING *',
      [id]
    );
    return result.rows[0] ?? null;
  }

  // ── Trigger Evaluation ────────────────────────────────────────────────────

  static async evaluateTrigger(
    triggerType: string,
    channel: string,
    data: Record<string, unknown>
  ): Promise<void> {
    try {
      const rules = await query<AutomationRule>(
        `SELECT * FROM automation_rules
         WHERE is_active = true AND trigger_type = $1 AND (channel = $2 OR channel = 'all')
         ORDER BY priority DESC`,
        [triggerType, channel]
      );
      for (const rule of rules.rows) {
        const conditions = (rule.conditions as unknown as Condition[]) ?? [];
        if (!conditions.every((c) => evalCondition(c, data))) continue;
        const actions = (rule.actions as unknown as RuleAction[]) ?? [];
        const executed: Array<{ type: string; status: string; error?: string }> = [];
        let hasError = false;
        for (const action of actions) {
          try {
            await AutomationService.executeAction(action.type, action.config ?? {}, data);
            executed.push({ type: action.type, status: 'success' });
          } catch (err) {
            hasError = true;
            executed.push({ type: action.type, status: 'failed', error: (err as Error).message });
            log.error(`Action ${action.type} failed for rule ${rule.id}`, err);
          }
        }
        await query(
          'UPDATE automation_rules SET last_triggered_at = NOW(), trigger_count = trigger_count + 1, updated_at = NOW() WHERE id = $1',
          [rule.id]
        );
        await query(
          `INSERT INTO automation_logs (rule_id, trigger_type, trigger_data, actions_executed, status)
           VALUES ($1,$2,$3::jsonb,$4::jsonb,$5)`,
          [rule.id, triggerType, JSON.stringify(data), JSON.stringify(executed), hasError ? 'partial' : 'success']
        );
        publishEvent('automation:rule_fired', {
          rule_id: rule.id, rule_name: rule.name,
          trigger_type: triggerType, channel, actions_count: executed.length, success: !hasError,
        });
      }
    } catch (err) {
      log.error('evaluateTrigger error', err);
    }
  }

  static async executeAction(
    type: string,
    config: Record<string, unknown>,
    triggerData: Record<string, unknown>
  ): Promise<void> {
    const channel = triggerData.channel as string;
    const sender = triggerData.sender as string;
    const threadId = triggerData.thread_id as string;

    switch (type) {
      case 'send_reply': {
        // Use direct DB + queue via inboxQueue to avoid circular import with InboxService
        if (threadId && config.body) {
          const { inboxQueue } = await import('../queues');
          await inboxQueue.add('reply', {
            action: 'send-reply',
            threadId,
            reply: { body: config.body as string, provider: config.provider as string | undefined },
          });
        }
        break;
      }
      case 'tag_lead': {
        if (channel && sender) {
          const lead = await LeadsService.getLeadByContact(channel, sender);
          if (lead && Array.isArray(config.tags)) {
            await LeadsService.tagLead(lead.id, config.tags as string[], 'add');
          }
        }
        break;
      }
      case 'set_segment': {
        if (channel && sender && config.segment) {
          const lead = await LeadsService.getLeadByContact(channel, sender);
          if (lead) await LeadsService.setSegment(lead.id, config.segment as 'hot' | 'warm' | 'cold');
        }
        break;
      }
      case 'assign_thread': {
        if (threadId && config.assigned_to) {
          await query(
            'UPDATE conversation_threads SET assigned_to = $2, updated_at = NOW() WHERE id = $1',
            [threadId, config.assigned_to]
          );
          publishEvent('inbox:assigned', { channel, thread_id: threadId, assigned_to: config.assigned_to });
        }
        break;
      }
      case 'escalate': {
        publishEvent('automation:escalation', {
          channel, thread_id: threadId, contact: sender,
          reason: config.reason ?? 'Auto-escalation',
          priority: 'high',
        });
        break;
      }
      case 'notify': {
        publishEvent('automation:notification', {
          channel, message: config.message ?? 'Automation triggered', data: triggerData,
        });
        break;
      }
      case 'create_followup': {
        const delayHours = Number(config.delay_hours ?? 24);
        const followupAt = new Date(Date.now() + delayHours * 3_600_000);
        const chan = channel as 'whatsapp' | 'sms' | 'email';
        const contacts = chan === 'email' ? [{ email: sender }] : [{ phone: sender }];
        await query(
          `INSERT INTO scheduled_campaigns (name, channel, campaign_config, schedule_type, scheduled_at, next_run_at, status)
           VALUES ($1,$2,$3::jsonb,'once',$4,$4,'pending')`,
          [
            `Followup – ${sender}`, chan,
            JSON.stringify({ contacts, message: config.message ?? 'Following up', subject: config.subject ?? 'Follow Up', campaign_name: `Followup – ${sender}` }),
            followupAt.toISOString(),
          ]
        );
        break;
      }
      default:
        log.warn(`Unknown action type: ${type}`);
    }
  }

  // ── Logs ──────────────────────────────────────────────────────────────────

  static async getLogs(opts?: { rule_id?: string; limit?: number; offset?: number }) {
    const conds: string[] = [];
    const params: unknown[] = [];
    if (opts?.rule_id) { params.push(opts.rule_id); conds.push(`l.rule_id = $${params.length}`); }
    const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
    params.push(opts?.limit ?? 50);
    params.push(opts?.offset ?? 0);
    const result = await query(
      `SELECT l.*, r.name AS rule_name
       FROM automation_logs l LEFT JOIN automation_rules r ON r.id = l.rule_id
       ${where} ORDER BY l.created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );
    return result.rows;
  }

  // ── Scheduled Campaigns ───────────────────────────────────────────────────

  static async createScheduledCampaign(data: {
    name: string; channel: string; campaign_config: Record<string, unknown>;
    schedule_type: string; scheduled_at: string;
  }): Promise<ScheduledCampaign> {
    const result = await query<ScheduledCampaign>(
      `INSERT INTO scheduled_campaigns (name, channel, campaign_config, schedule_type, scheduled_at, next_run_at, status)
       VALUES ($1,$2,$3::jsonb,$4,$5,$5,'pending') RETURNING *`,
      [data.name, data.channel, JSON.stringify(data.campaign_config), data.schedule_type, data.scheduled_at]
    );
    return result.rows[0];
  }

  static async listScheduledCampaigns(opts?: { channel?: string; status?: string }): Promise<ScheduledCampaign[]> {
    const conds: string[] = [];
    const params: unknown[] = [];
    if (opts?.channel) { params.push(opts.channel); conds.push(`channel = $${params.length}`); }
    if (opts?.status) { params.push(opts.status); conds.push(`status = $${params.length}`); }
    const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
    const result = await query<ScheduledCampaign>(`SELECT * FROM scheduled_campaigns ${where} ORDER BY scheduled_at DESC`, params);
    return result.rows;
  }

  static async updateScheduledCampaign(id: string, data: {
    name?: string; campaign_config?: Record<string, unknown>;
    schedule_type?: string; scheduled_at?: string; status?: string;
  }): Promise<ScheduledCampaign | null> {
    const sets: string[] = ['updated_at = NOW()'];
    const params: unknown[] = [];
    if (data.name !== undefined) { params.push(data.name); sets.push(`name = $${params.length}`); }
    if (data.campaign_config !== undefined) { params.push(JSON.stringify(data.campaign_config)); sets.push(`campaign_config = $${params.length}::jsonb`); }
    if (data.schedule_type !== undefined) { params.push(data.schedule_type); sets.push(`schedule_type = $${params.length}`); }
    if (data.scheduled_at !== undefined) { params.push(data.scheduled_at); sets.push(`scheduled_at = $${params.length}`); sets.push(`next_run_at = $${params.length}`); }
    if (data.status !== undefined) { params.push(data.status); sets.push(`status = $${params.length}`); }
    params.push(id);
    const result = await query<ScheduledCampaign>(
      `UPDATE scheduled_campaigns SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING *`,
      params
    );
    return result.rows[0] ?? null;
  }

  static async cancelScheduledCampaign(id: string): Promise<ScheduledCampaign | null> {
    const result = await query<ScheduledCampaign>(
      `UPDATE scheduled_campaigns SET status = 'paused', updated_at = NOW()
       WHERE id = $1 AND status = 'pending' RETURNING *`,
      [id]
    );
    return result.rows[0] ?? null;
  }

  static async deleteScheduledCampaign(id: string): Promise<boolean> {
    const result = await query('DELETE FROM scheduled_campaigns WHERE id = $1', [id]);
    return (result.rowCount ?? 0) > 0;
  }

  // ── Background Tasks ──────────────────────────────────────────────────────

  static async runDueScheduledCampaigns(): Promise<number> {
    const result = await query<ScheduledCampaign>(
      `SELECT * FROM scheduled_campaigns WHERE status = 'pending' AND next_run_at <= NOW() LIMIT 20`
    );
    let ran = 0;
    for (const campaign of result.rows) {
      try {
        await query(
          `UPDATE scheduled_campaigns SET status = 'running', last_run_at = NOW(), run_count = run_count + 1, updated_at = NOW() WHERE id = $1`,
          [campaign.id]
        );
        publishEvent('automation:scheduled_campaign_start', {
          campaign_id: campaign.id, channel: campaign.channel,
          name: campaign.name, config: campaign.campaign_config,
        });
        const nextRun = AutomationService.getNextRunTime(campaign.schedule_type, new Date(campaign.scheduled_at));
        await query(
          `UPDATE scheduled_campaigns SET status = $2, next_run_at = $3, updated_at = NOW() WHERE id = $1`,
          [campaign.id, campaign.schedule_type === 'once' ? 'completed' : 'pending', nextRun?.toISOString() ?? null]
        );
        ran++;
      } catch (err) {
        log.error(`Scheduled campaign ${campaign.id} failed`, err);
        await query(`UPDATE scheduled_campaigns SET status = 'failed', updated_at = NOW() WHERE id = $1`, [campaign.id]);
      }
    }
    return ran;
  }

  static getNextRunTime(scheduleType: string, base: Date): Date | null {
    const now = new Date();
    switch (scheduleType) {
      case 'daily': { const d = new Date(base); while (d <= now) d.setDate(d.getDate() + 1); return d; }
      case 'weekly': { const d = new Date(base); while (d <= now) d.setDate(d.getDate() + 7); return d; }
      case 'monthly': { const d = new Date(base); while (d <= now) d.setMonth(d.getMonth() + 1); return d; }
      default: return null;
    }
  }

  static async cleanupOldMessages(daysOld = 90): Promise<{ deleted: number }> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - daysOld);
    let total = 0;
    for (const table of ['whatsapp_messages', 'sms_messages', 'email_messages']) {
      const r = await query(`DELETE FROM ${table} WHERE status = 'failed' AND created_at < $1`, [cutoff.toISOString()]);
      total += r.rowCount ?? 0;
    }
    const logCutoff = new Date();
    logCutoff.setDate(logCutoff.getDate() - 30);
    const lr = await query('DELETE FROM automation_logs WHERE created_at < $1', [logCutoff.toISOString()]);
    total += lr.rowCount ?? 0;
    log.info(`Cleanup deleted ${total} records`);
    return { deleted: total };
  }

  static async detectNoReplies(hoursThreshold = 24): Promise<void> {
    const cutoff = new Date();
    cutoff.setHours(cutoff.getHours() - hoursThreshold);
    const result = await query<{ id: string; channel: string; contact_value: string }>(
      `SELECT id, channel, contact_value FROM conversation_threads
       WHERE status = 'unread' AND last_message_at < $1 LIMIT 50`,
      [cutoff.toISOString()]
    );
    for (const t of result.rows) {
      await AutomationService.evaluateTrigger('no_reply', t.channel, {
        thread_id: t.id, channel: t.channel, sender: t.contact_value,
        hours_since_last_message: hoursThreshold,
      });
    }
  }

  static async checkProviderHealth(): Promise<void> {
    const result = await query(
      `SELECT id, name, channel FROM provider_configs
       WHERE is_active = true AND (validated_at IS NULL OR validated_at < NOW() - INTERVAL '1 hour') LIMIT 10`
    );
    if (result.rows.length > 0) {
      publishEvent('automation:health_check', {
        provider_count: result.rows.length,
        providers: result.rows.map((p: Record<string, unknown>) => ({ id: p.id, name: p.name, channel: p.channel })),
      });
    }
  }
}
