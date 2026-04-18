/**
 * Bot Manager Service
 * 
 * Core service for bot management, trigger evaluation, rule processing, and action execution.
 */

import { query } from '../../../packages/db/src/connection';
import { publishEvent } from '../../../packages/db/src/redis';
import { createLogger } from '../../../packages/utils/src/logger';
import { inboxQueue } from '../../../packages/utils/src/queues';

const log = createLogger('bot-service');

// ══════════════════════════════════════════════════════════════════════════
// TYPES
// ══════════════════════════════════════════════════════════════════════════

export interface Bot {
  id: string;
  tenant_id: string | null;
  name: string;
  description: string | null;
  channel: string;
  bot_type: string;
  is_active: boolean;
  priority: number;
  config: Record<string, unknown>;
  welcome_message: string | null;
  fallback_message: string;
  human_handoff_enabled: boolean;
  human_handoff_keywords: string[];
  business_hours: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
}

export interface BotTrigger {
  id: string;
  bot_id: string;
  trigger_type: string;
  trigger_config: Record<string, unknown>;
  is_active: boolean;
  priority: number;
}

export interface BotRule {
  id: string;
  bot_id: string;
  name: string;
  description: string | null;
  rule_order: number;
  conditions: Condition[];
  match_type: 'all' | 'any';
  is_active: boolean;
}

export interface BotAction {
  id: string;
  rule_id: string;
  action_type: string;
  action_config: Record<string, unknown>;
  action_order: number;
}

export interface BotConversation {
  id: string;
  bot_id: string;
  channel: string;
  contact_value: string;
  contact_name: string | null;
  lead_id: string | null;
  thread_id: string | null;
  status: 'active' | 'paused' | 'completed' | 'handed_off';
  current_step: string | null;
  context: Record<string, unknown>;
  variables: Record<string, unknown>;
  message_count: number;
  last_message_at: Date | null;
}

export interface Condition {
  field: string;
  operator: string;
  value: unknown;
}

export interface TriggerContext {
  channel: string;
  contact_value: string;
  contact_name?: string;
  message?: string;
  thread_id?: string;
  lead_id?: string;
  metadata?: Record<string, unknown>;
}

// ══════════════════════════════════════════════════════════════════════════
// BOT CRUD
// ══════════════════════════════════════════════════════════════════════════

export class BotService {
  static async createBot(data: {
    tenant_id?: string;
    name: string;
    description?: string;
    channel: string;
    bot_type: string;
    config?: Record<string, unknown>;
    welcome_message?: string;
    fallback_message?: string;
    human_handoff_enabled?: boolean;
    human_handoff_keywords?: string[];
  }): Promise<Bot> {
    const result = await query<Bot>(
      `INSERT INTO bots (tenant_id, name, description, channel, bot_type, config, welcome_message, fallback_message, human_handoff_enabled, human_handoff_keywords)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, $9, $10)
       RETURNING *`,
      [
        data.tenant_id ?? null,
        data.name,
        data.description ?? null,
        data.channel,
        data.bot_type,
        JSON.stringify(data.config ?? {}),
        data.welcome_message ?? null,
        data.fallback_message ?? 'Sorry, I didn\'t understand that.',
        data.human_handoff_enabled ?? true,
        data.human_handoff_keywords ?? ['human', 'agent', 'help'],
      ]
    );
    return result.rows[0];
  }

  static async listBots(opts?: {
    tenant_id?: string;
    channel?: string;
    bot_type?: string;
    is_active?: boolean;
  }): Promise<Bot[]> {
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (opts?.tenant_id) {
      params.push(opts.tenant_id);
      conditions.push(`tenant_id = $${params.length}`);
    }
    if (opts?.channel) {
      params.push(opts.channel);
      conditions.push(`(channel = $${params.length} OR channel = 'all')`);
    }
    if (opts?.bot_type) {
      params.push(opts.bot_type);
      conditions.push(`bot_type = $${params.length}`);
    }
    if (opts?.is_active !== undefined) {
      params.push(opts.is_active);
      conditions.push(`is_active = $${params.length}`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const result = await query<Bot>(
      `SELECT * FROM bots ${where} ORDER BY priority DESC, created_at DESC`,
      params
    );
    return result.rows;
  }

  static async getBot(id: string): Promise<Bot | null> {
    const result = await query<Bot>('SELECT * FROM bots WHERE id = $1', [id]);
    return result.rows[0] ?? null;
  }

  static async updateBot(id: string, data: Partial<Bot>): Promise<Bot | null> {
    const sets: string[] = ['updated_at = NOW()'];
    const params: unknown[] = [];

    const fields = ['name', 'description', 'channel', 'bot_type', 'is_active', 'priority',
      'welcome_message', 'fallback_message', 'human_handoff_enabled'];
    
    for (const field of fields) {
      if ((data as Record<string, unknown>)[field] !== undefined) {
        params.push((data as Record<string, unknown>)[field]);
        sets.push(`${field} = $${params.length}`);
      }
    }

    if (data.config !== undefined) {
      params.push(JSON.stringify(data.config));
      sets.push(`config = $${params.length}::jsonb`);
    }
    if (data.human_handoff_keywords !== undefined) {
      params.push(data.human_handoff_keywords);
      sets.push(`human_handoff_keywords = $${params.length}`);
    }
    if (data.business_hours !== undefined) {
      params.push(JSON.stringify(data.business_hours));
      sets.push(`business_hours = $${params.length}::jsonb`);
    }

    params.push(id);
    const result = await query<Bot>(
      `UPDATE bots SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING *`,
      params
    );
    return result.rows[0] ?? null;
  }

  static async deleteBot(id: string): Promise<boolean> {
    const result = await query('DELETE FROM bots WHERE id = $1', [id]);
    return (result.rowCount ?? 0) > 0;
  }

  static async toggleBot(id: string): Promise<Bot | null> {
    const result = await query<Bot>(
      'UPDATE bots SET is_active = NOT is_active, updated_at = NOW() WHERE id = $1 RETURNING *',
      [id]
    );
    return result.rows[0] ?? null;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // TRIGGERS
  // ══════════════════════════════════════════════════════════════════════════

  static async createTrigger(data: {
    bot_id: string;
    trigger_type: string;
    trigger_config?: Record<string, unknown>;
    priority?: number;
  }): Promise<BotTrigger> {
    const result = await query<BotTrigger>(
      `INSERT INTO bot_triggers (bot_id, trigger_type, trigger_config, priority)
       VALUES ($1, $2, $3::jsonb, $4) RETURNING *`,
      [data.bot_id, data.trigger_type, JSON.stringify(data.trigger_config ?? {}), data.priority ?? 0]
    );
    return result.rows[0];
  }

  static async listTriggers(botId: string): Promise<BotTrigger[]> {
    const result = await query<BotTrigger>(
      'SELECT * FROM bot_triggers WHERE bot_id = $1 ORDER BY priority DESC',
      [botId]
    );
    return result.rows;
  }

  static async deleteTrigger(id: string): Promise<boolean> {
    const result = await query('DELETE FROM bot_triggers WHERE id = $1', [id]);
    return (result.rowCount ?? 0) > 0;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // RULES
  // ══════════════════════════════════════════════════════════════════════════

  static async createRule(data: {
    bot_id: string;
    name: string;
    description?: string;
    conditions: Condition[];
    match_type?: 'all' | 'any';
    rule_order?: number;
  }): Promise<BotRule> {
    const result = await query<BotRule>(
      `INSERT INTO bot_rules (bot_id, name, description, conditions, match_type, rule_order)
       VALUES ($1, $2, $3, $4::jsonb, $5, $6) RETURNING *`,
      [
        data.bot_id,
        data.name,
        data.description ?? null,
        JSON.stringify(data.conditions),
        data.match_type ?? 'all',
        data.rule_order ?? 0,
      ]
    );
    return result.rows[0];
  }

  static async listRules(botId: string): Promise<BotRule[]> {
    const result = await query<BotRule>(
      'SELECT * FROM bot_rules WHERE bot_id = $1 AND is_active = true ORDER BY rule_order',
      [botId]
    );
    return result.rows;
  }

  static async deleteRule(id: string): Promise<boolean> {
    const result = await query('DELETE FROM bot_rules WHERE id = $1', [id]);
    return (result.rowCount ?? 0) > 0;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // ACTIONS
  // ══════════════════════════════════════════════════════════════════════════

  static async createAction(data: {
    rule_id: string;
    action_type: string;
    action_config: Record<string, unknown>;
    action_order?: number;
  }): Promise<BotAction> {
    const result = await query<BotAction>(
      `INSERT INTO bot_actions (rule_id, action_type, action_config, action_order)
       VALUES ($1, $2, $3::jsonb, $4) RETURNING *`,
      [data.rule_id, data.action_type, JSON.stringify(data.action_config), data.action_order ?? 0]
    );
    return result.rows[0];
  }

  static async listActions(ruleId: string): Promise<BotAction[]> {
    const result = await query<BotAction>(
      'SELECT * FROM bot_actions WHERE rule_id = $1 ORDER BY action_order',
      [ruleId]
    );
    return result.rows;
  }

  static async deleteAction(id: string): Promise<boolean> {
    const result = await query('DELETE FROM bot_actions WHERE id = $1', [id]);
    return (result.rowCount ?? 0) > 0;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // CONVERSATIONS
  // ══════════════════════════════════════════════════════════════════════════

  static async getOrCreateConversation(
    botId: string,
    channel: string,
    contactValue: string,
    contactName?: string
  ): Promise<BotConversation> {
    // Try to find active conversation
    const existing = await query<BotConversation>(
      `SELECT * FROM bot_conversations 
       WHERE bot_id = $1 AND channel = $2 AND contact_value = $3 AND status = 'active'`,
      [botId, channel, contactValue]
    );

    if (existing.rows[0]) {
      return existing.rows[0];
    }

    // Create new conversation
    const result = await query<BotConversation>(
      `INSERT INTO bot_conversations (bot_id, channel, contact_value, contact_name)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [botId, channel, contactValue, contactName ?? null]
    );
    return result.rows[0];
  }

  static async updateConversation(
    id: string,
    data: Partial<{
      status: string;
      current_step: string;
      context: Record<string, unknown>;
      variables: Record<string, unknown>;
      thread_id: string;
      lead_id: string;
    }>
  ): Promise<BotConversation | null> {
    const sets: string[] = ['updated_at = NOW()'];
    const params: unknown[] = [];

    if (data.status) {
      params.push(data.status);
      sets.push(`status = $${params.length}`);
      if (data.status === 'completed') sets.push('ended_at = NOW()');
      if (data.status === 'handed_off') sets.push('handed_off_at = NOW()');
    }
    if (data.current_step !== undefined) {
      params.push(data.current_step);
      sets.push(`current_step = $${params.length}`);
    }
    if (data.context) {
      params.push(JSON.stringify(data.context));
      sets.push(`context = $${params.length}::jsonb`);
    }
    if (data.variables) {
      params.push(JSON.stringify(data.variables));
      sets.push(`variables = $${params.length}::jsonb`);
    }
    if (data.thread_id) {
      params.push(data.thread_id);
      sets.push(`thread_id = $${params.length}`);
    }
    if (data.lead_id) {
      params.push(data.lead_id);
      sets.push(`lead_id = $${params.length}`);
    }

    params.push(id);
    const result = await query<BotConversation>(
      `UPDATE bot_conversations SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING *`,
      params
    );
    return result.rows[0] ?? null;
  }

  static async incrementMessageCount(conversationId: string): Promise<void> {
    await query(
      `UPDATE bot_conversations 
       SET message_count = message_count + 1, last_message_at = NOW(), updated_at = NOW()
       WHERE id = $1`,
      [conversationId]
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // TRIGGER ENGINE
  // ══════════════════════════════════════════════════════════════════════════

  static async evaluateTriggers(
    triggerType: string,
    context: TriggerContext
  ): Promise<void> {
    const startTime = Date.now();

    try {
      // Find all active bots with matching triggers
      const botsResult = await query<Bot & { trigger_id: string; trigger_config: Record<string, unknown> }>(
        `SELECT b.*, t.id as trigger_id, t.trigger_config
         FROM bots b
         JOIN bot_triggers t ON t.bot_id = b.id
         WHERE b.is_active = true
           AND t.is_active = true
           AND t.trigger_type = $1
           AND (b.channel = $2 OR b.channel = 'all')
         ORDER BY b.priority DESC, t.priority DESC`,
        [triggerType, context.channel]
      );

      for (const bot of botsResult.rows) {
        try {
          // Check trigger conditions
          if (!BotService.matchesTriggerConfig(bot.trigger_config, context)) {
            continue;
          }

          // Check business hours if enabled
          if (bot.business_hours && (bot.business_hours as Record<string, unknown>).enabled) {
            if (!BotService.isWithinBusinessHours(bot.business_hours)) {
              continue;
            }
          }

          // Get or create conversation
          const conversation = await BotService.getOrCreateConversation(
            bot.id,
            context.channel,
            context.contact_value,
            context.contact_name
          );

          // Check for human handoff keywords
          if (bot.human_handoff_enabled && context.message) {
            const lowerMessage = context.message.toLowerCase();
            const handoffKeywords = bot.human_handoff_keywords || [];
            if (handoffKeywords.some(kw => lowerMessage.includes(kw.toLowerCase()))) {
              await BotService.handoffToHuman(conversation.id, bot.id, context);
              continue;
            }
          }

          // Process bot rules
          await BotService.processRules(bot, conversation, context);

          // Log execution
          await BotService.logExecution(bot.id, conversation.id, bot.trigger_id, null, null, 'trigger_matched', context, {}, 'success', null, Date.now() - startTime);

        } catch (err) {
          log.error(`Bot ${bot.id} trigger evaluation failed`, err);
          await BotService.logExecution(bot.id, null, bot.trigger_id, null, null, 'trigger_error', context, {}, 'failed', (err as Error).message, Date.now() - startTime);
        }
      }
    } catch (err) {
      log.error('evaluateTriggers failed', err);
    }
  }

  static matchesTriggerConfig(config: Record<string, unknown>, context: TriggerContext): boolean {
    if (!config || Object.keys(config).length === 0) return true;

    // Keyword matching
    if (config.keywords && Array.isArray(config.keywords) && context.message) {
      const lowerMessage = context.message.toLowerCase();
      const keywords = config.keywords as string[];
      const matchMode = config.keyword_match_mode || 'any';
      
      if (matchMode === 'all') {
        return keywords.every(kw => lowerMessage.includes(kw.toLowerCase()));
      }
      return keywords.some(kw => lowerMessage.includes(kw.toLowerCase()));
    }

    // Regex matching
    if (config.regex && context.message) {
      try {
        const regex = new RegExp(config.regex as string, 'i');
        return regex.test(context.message);
      } catch {
        return false;
      }
    }

    return true;
  }

  static isWithinBusinessHours(config: Record<string, unknown>): boolean {
    if (!config.enabled) return true;

    const now = new Date();
    const dayOfWeek = now.toLocaleDateString('en-US', { weekday: 'lowercase' });
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const currentTime = currentHour * 60 + currentMinute;

    const schedule = config.schedule as Record<string, { start: string; end: string }> | undefined;
    if (!schedule || !schedule[dayOfWeek]) return true;

    const daySchedule = schedule[dayOfWeek];
    const [startHour, startMin] = daySchedule.start.split(':').map(Number);
    const [endHour, endMin] = daySchedule.end.split(':').map(Number);
    const startTime = startHour * 60 + startMin;
    const endTime = endHour * 60 + endMin;

    return currentTime >= startTime && currentTime <= endTime;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // RULE ENGINE
  // ══════════════════════════════════════════════════════════════════════════

  static async processRules(
    bot: Bot,
    conversation: BotConversation,
    context: TriggerContext
  ): Promise<void> {
    const rules = await BotService.listRules(bot.id);

    for (const rule of rules) {
      const conditions = (rule.conditions as unknown as Condition[]) || [];
      const matchType = rule.match_type || 'all';

      // Evaluate conditions
      const results = conditions.map(c => BotService.evaluateCondition(c, context, conversation));
      const matches = matchType === 'all' 
        ? results.every(r => r)
        : results.some(r => r);

      if (matches) {
        // Execute actions for this rule
        await BotService.executeRuleActions(rule.id, bot, conversation, context);
        
        // If rule matched, we might want to stop processing (configurable)
        if (bot.config?.stop_on_first_match) {
          break;
        }
      }
    }

    // If no rules matched, send fallback message
    if (rules.length === 0 || !bot.config?.stop_on_first_match) {
      if (bot.fallback_message && context.message) {
        await BotService.sendBotMessage(conversation, bot.fallback_message, context);
      }
    }
  }

  static evaluateCondition(
    condition: Condition,
    context: TriggerContext,
    conversation: BotConversation
  ): boolean {
    const data: Record<string, unknown> = {
      ...context,
      ...context.metadata,
      ...conversation.variables,
      message_count: conversation.message_count,
    };

    const value = data[condition.field];

    switch (condition.operator) {
      case 'equals':
        return value === condition.value;
      case 'not_equals':
        return value !== condition.value;
      case 'contains':
        return typeof value === 'string' && value.toLowerCase().includes(String(condition.value).toLowerCase());
      case 'not_contains':
        return typeof value === 'string' && !value.toLowerCase().includes(String(condition.value).toLowerCase());
      case 'starts_with':
        return typeof value === 'string' && value.toLowerCase().startsWith(String(condition.value).toLowerCase());
      case 'ends_with':
        return typeof value === 'string' && value.toLowerCase().endsWith(String(condition.value).toLowerCase());
      case 'regex':
        try {
          return typeof value === 'string' && new RegExp(String(condition.value), 'i').test(value);
        } catch {
          return false;
        }
      case 'greater_than':
        return Number(value) > Number(condition.value);
      case 'less_than':
        return Number(value) < Number(condition.value);
      case 'in':
        return Array.isArray(condition.value) && condition.value.includes(value);
      case 'not_in':
        return Array.isArray(condition.value) && !condition.value.includes(value);
      case 'exists':
        return value !== undefined && value !== null;
      case 'not_exists':
        return value === undefined || value === null;
      default:
        return true;
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // ACTION ENGINE
  // ══════════════════════════════════════════════════════════════════════════

  static async executeRuleActions(
    ruleId: string,
    bot: Bot,
    conversation: BotConversation,
    context: TriggerContext
  ): Promise<void> {
    const actions = await BotService.listActions(ruleId);

    for (const action of actions) {
      try {
        await BotService.executeAction(action, bot, conversation, context);
        await BotService.logExecution(bot.id, conversation.id, null, ruleId, action.id, 'action_executed', context, action.action_config, 'success', null, 0);
      } catch (err) {
        log.error(`Action ${action.id} failed`, err);
        await BotService.logExecution(bot.id, conversation.id, null, ruleId, action.id, 'action_failed', context, action.action_config, 'failed', (err as Error).message, 0);
      }
    }
  }

  static async executeAction(
    action: BotAction,
    bot: Bot,
    conversation: BotConversation,
    context: TriggerContext
  ): Promise<void> {
    const config = action.action_config;

    switch (action.action_type) {
      case 'send_message': {
        const message = BotService.interpolateVariables(
          config.message as string,
          context,
          conversation.variables
        );
        await BotService.sendBotMessage(conversation, message, context);
        break;
      }

      case 'send_template': {
        const templateId = config.template_id as string;
        const params = config.params as Record<string, string> || {};
        await BotService.sendBotTemplate(conversation, templateId, params, context);
        break;
      }

      case 'ask_question': {
        const question = config.question as string;
        const variableName = config.variable_name as string;
        await BotService.sendBotMessage(conversation, question, context);
        await BotService.updateConversation(conversation.id, {
          current_step: `awaiting_${variableName}`,
          context: { ...conversation.context, awaiting_variable: variableName },
        });
        break;
      }

      case 'set_variable': {
        const varName = config.variable_name as string;
        const varValue = config.value ?? context.message;
        const newVars = { ...conversation.variables, [varName]: varValue };
        await BotService.updateConversation(conversation.id, { variables: newVars });
        break;
      }

      case 'tag_lead': {
        if (conversation.lead_id && Array.isArray(config.tags)) {
          await query(
            `UPDATE leads SET tags = array_cat(tags, $1), updated_at = NOW() WHERE id = $2`,
            [config.tags, conversation.lead_id]
          );
        }
        break;
      }

      case 'assign_agent': {
        const agentId = config.agent_id as string;
        if (conversation.thread_id) {
          await query(
            'UPDATE conversation_threads SET assigned_to = $1, updated_at = NOW() WHERE id = $2',
            [agentId, conversation.thread_id]
          );
        }
        break;
      }

      case 'human_handoff': {
        await BotService.handoffToHuman(conversation.id, bot.id, context);
        break;
      }

      case 'end_conversation': {
        await BotService.updateConversation(conversation.id, { status: 'completed' });
        if (config.closing_message) {
          await BotService.sendBotMessage(conversation, config.closing_message as string, context);
        }
        break;
      }

      case 'delay': {
        const delayMs = (config.seconds as number || 1) * 1000;
        await new Promise(resolve => setTimeout(resolve, delayMs));
        break;
      }

      case 'trigger_webhook': {
        const webhookUrl = config.url as string;
        if (webhookUrl) {
          fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ bot_id: bot.id, conversation_id: conversation.id, context }),
          }).catch(err => log.error('Webhook trigger failed', err));
        }
        break;
      }

      default:
        log.warn(`Unknown action type: ${action.action_type}`);
    }
  }

  static interpolateVariables(
    template: string,
    context: TriggerContext,
    variables: Record<string, unknown>
  ): string {
    const data = { ...context, ...context.metadata, ...variables };
    return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
      return String(data[key] ?? '');
    });
  }

  static async sendBotMessage(
    conversation: BotConversation,
    message: string,
    context: TriggerContext
  ): Promise<void> {
    // Store bot message
    await query(
      `INSERT INTO bot_messages (conversation_id, direction, content, message_type)
       VALUES ($1, 'outbound', $2, 'text')`,
      [conversation.id, message]
    );

    // Queue message for sending via inbox
    await inboxQueue.add('reply', {
      action: 'send-reply',
      threadId: conversation.thread_id,
      reply: {
        body: message,
        channel: conversation.channel,
        recipient: conversation.contact_value,
      },
    });

    await BotService.incrementMessageCount(conversation.id);

    publishEvent('bot:message_sent', {
      bot_id: conversation.bot_id,
      conversation_id: conversation.id,
      channel: conversation.channel,
      contact: conversation.contact_value,
    });
  }

  static async sendBotTemplate(
    conversation: BotConversation,
    templateId: string,
    params: Record<string, string>,
    context: TriggerContext
  ): Promise<void> {
    await inboxQueue.add('reply', {
      action: 'send-template',
      threadId: conversation.thread_id,
      reply: {
        template_id: templateId,
        params,
        channel: conversation.channel,
        recipient: conversation.contact_value,
      },
    });

    await BotService.incrementMessageCount(conversation.id);
  }

  static async handoffToHuman(
    conversationId: string,
    botId: string,
    context: TriggerContext
  ): Promise<void> {
    await BotService.updateConversation(conversationId, { status: 'handed_off' });

    publishEvent('bot:human_handoff', {
      bot_id: botId,
      conversation_id: conversationId,
      channel: context.channel,
      contact: context.contact_value,
      reason: 'User requested human assistance',
    });

    // Notify agents
    publishEvent('inbox:escalation', {
      channel: context.channel,
      contact: context.contact_value,
      reason: 'Bot handoff - user requested human',
      priority: 'high',
    });
  }

  // ══════════════════════════════════════════════════════════════════════════
  // LOGGING
  // ══════════════════════════════════════════════════════════════════════════

  static async logExecution(
    botId: string,
    conversationId: string | null,
    triggerId: string | null,
    ruleId: string | null,
    actionId: string | null,
    eventType: string,
    inputData: Record<string, unknown>,
    outputData: Record<string, unknown>,
    status: 'success' | 'failed' | 'skipped',
    errorMessage: string | null,
    executionTimeMs: number
  ): Promise<void> {
    await query(
      `INSERT INTO bot_execution_logs 
       (bot_id, conversation_id, trigger_id, rule_id, action_id, event_type, input_data, output_data, status, error_message, execution_time_ms)
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb, $9, $10, $11)`,
      [botId, conversationId, triggerId, ruleId, actionId, eventType, JSON.stringify(inputData), JSON.stringify(outputData), status, errorMessage, executionTimeMs]
    );
  }

  static async getLogs(opts?: {
    bot_id?: string;
    conversation_id?: string;
    status?: string;
    limit?: number;
    offset?: number;
  }): Promise<unknown[]> {
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (opts?.bot_id) {
      params.push(opts.bot_id);
      conditions.push(`bot_id = $${params.length}`);
    }
    if (opts?.conversation_id) {
      params.push(opts.conversation_id);
      conditions.push(`conversation_id = $${params.length}`);
    }
    if (opts?.status) {
      params.push(opts.status);
      conditions.push(`status = $${params.length}`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    params.push(opts?.limit ?? 50);
    params.push(opts?.offset ?? 0);

    const result = await query(
      `SELECT * FROM bot_execution_logs ${where} ORDER BY created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );
    return result.rows;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // STATS
  // ══════════════════════════════════════════════════════════════════════════

  static async getStats(tenantId?: string): Promise<{
    total_bots: number;
    active_bots: number;
    total_conversations: number;
    active_conversations: number;
    messages_sent_today: number;
    handoffs_today: number;
  }> {
    const tenantClause = tenantId ? 'AND tenant_id = $1' : '';
    const params = tenantId ? [tenantId] : [];

    const result = await query<{
      total_bots: string;
      active_bots: string;
      total_conversations: string;
      active_conversations: string;
      messages_sent_today: string;
      handoffs_today: string;
    }>(
      `SELECT
        (SELECT COUNT(*) FROM bots WHERE 1=1 ${tenantClause})::int AS total_bots,
        (SELECT COUNT(*) FROM bots WHERE is_active = true ${tenantClause})::int AS active_bots,
        (SELECT COUNT(*) FROM bot_conversations)::int AS total_conversations,
        (SELECT COUNT(*) FROM bot_conversations WHERE status = 'active')::int AS active_conversations,
        (SELECT COUNT(*) FROM bot_messages WHERE direction = 'outbound' AND created_at >= CURRENT_DATE)::int AS messages_sent_today,
        (SELECT COUNT(*) FROM bot_conversations WHERE status = 'handed_off' AND handed_off_at >= CURRENT_DATE)::int AS handoffs_today`,
      params
    );

    const r = result.rows[0];
    return {
      total_bots: Number(r?.total_bots ?? 0),
      active_bots: Number(r?.active_bots ?? 0),
      total_conversations: Number(r?.total_conversations ?? 0),
      active_conversations: Number(r?.active_conversations ?? 0),
      messages_sent_today: Number(r?.messages_sent_today ?? 0),
      handoffs_today: Number(r?.handoffs_today ?? 0),
    };
  }
}
