import { query } from '../../../packages/db/src/connection';
import { redisPub } from '../../../packages/db/src/redis';
import { createLogger } from '../../../packages/utils/src/logger';

const log = createLogger('wa-saas-service');

function publishEvent(channel: string, data: unknown) {
  redisPub.publish(channel, JSON.stringify(data)).catch(() => {});
}

// ══════════════════════════════════════════════════════════════════════════
//  MODULE 1: DRIP MARKETING
// ══════════════════════════════════════════════════════════════════════════
export class DripService {
  // ── Campaigns ──
  static async listCampaigns(tenantId: string) {
    const r = await query(`SELECT * FROM wa_drip_campaigns WHERE tenant_id = $1 ORDER BY created_at DESC`, [tenantId]);
    return r.rows;
  }

  static async getCampaign(tenantId: string, id: string) {
    const r = await query(`SELECT * FROM wa_drip_campaigns WHERE id = $1 AND tenant_id = $2`, [id, tenantId]);
    return r.rows[0] || null;
  }

  static async createCampaign(tenantId: string, data: Record<string, unknown>) {
    const r = await query(
      `INSERT INTO wa_drip_campaigns (tenant_id, name, description, trigger_type, trigger_config, segment_filter, stop_on_reply)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [tenantId, data.name, data.description, data.trigger_type, JSON.stringify(data.trigger_config), JSON.stringify(data.segment_filter), data.stop_on_reply]
    );
    return r.rows[0];
  }

  static async updateCampaign(tenantId: string, id: string, data: Record<string, unknown>) {
    const sets: string[] = []; const vals: unknown[] = []; let idx = 1;
    for (const [k, v] of Object.entries(data)) {
      if (v === undefined) continue;
      sets.push(`${k} = $${idx++}`);
      vals.push(k === 'trigger_config' || k === 'segment_filter' ? JSON.stringify(v) : v);
    }
    if (!sets.length) return null;
    sets.push(`updated_at = NOW()`);
    vals.push(id, tenantId);
    const r = await query(`UPDATE wa_drip_campaigns SET ${sets.join(', ')} WHERE id = $${idx++} AND tenant_id = $${idx} RETURNING *`, vals);
    return r.rows[0] || null;
  }

  static async deleteCampaign(tenantId: string, id: string) {
    await query(`DELETE FROM wa_drip_campaigns WHERE id = $1 AND tenant_id = $2`, [id, tenantId]);
  }

  static async toggleCampaign(tenantId: string, id: string) {
    const r = await query(`UPDATE wa_drip_campaigns SET is_active = NOT is_active, updated_at = NOW() WHERE id = $1 AND tenant_id = $2 RETURNING *`, [id, tenantId]);
    return r.rows[0] || null;
  }

  // ── Steps ──
  static async listSteps(tenantId: string, campaignId: string) {
    const r = await query(`SELECT * FROM wa_drip_steps WHERE campaign_id = $1 AND tenant_id = $2 ORDER BY step_order`, [campaignId, tenantId]);
    return r.rows;
  }

  static async createStep(tenantId: string, data: Record<string, unknown>) {
    const r = await query(
      `INSERT INTO wa_drip_steps (tenant_id, campaign_id, step_order, delay_days, delay_hours, message_type, template_name, message_body, media_url, buttons)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [tenantId, data.campaign_id, data.step_order, data.delay_days, data.delay_hours, data.message_type, data.template_name, data.message_body, data.media_url, JSON.stringify(data.buttons)]
    );
    return r.rows[0];
  }

  static async updateStep(tenantId: string, id: string, data: Record<string, unknown>) {
    const sets: string[] = []; const vals: unknown[] = []; let idx = 1;
    for (const [k, v] of Object.entries(data)) {
      if (v === undefined) continue;
      sets.push(`${k} = $${idx++}`);
      vals.push(k === 'buttons' ? JSON.stringify(v) : v);
    }
    if (!sets.length) return null;
    vals.push(id, tenantId);
    const r = await query(`UPDATE wa_drip_steps SET ${sets.join(', ')} WHERE id = $${idx++} AND tenant_id = $${idx} RETURNING *`, vals);
    return r.rows[0] || null;
  }

  static async deleteStep(tenantId: string, id: string) {
    await query(`DELETE FROM wa_drip_steps WHERE id = $1 AND tenant_id = $2`, [id, tenantId]);
  }

  // ── Enrollments ──
  static async enroll(tenantId: string, data: Record<string, unknown>) {
    const { rows: steps } = await query(`SELECT * FROM wa_drip_steps WHERE campaign_id = $1 AND tenant_id = $2 ORDER BY step_order LIMIT 1`, [data.campaign_id, tenantId]);
    const firstStep = steps[0];
    const nextAt = firstStep ? new Date(Date.now() + ((firstStep.delay_days as number) * 86400000 + (firstStep.delay_hours as number) * 3600000)).toISOString() : null;
    const r = await query(
      `INSERT INTO wa_drip_enrollments (tenant_id, campaign_id, contact_phone, contact_name, next_action_at)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [tenantId, data.campaign_id, data.contact_phone, data.contact_name, nextAt]
    );
    await query(`UPDATE wa_drip_campaigns SET enrolled_count = enrolled_count + 1 WHERE id = $1`, [data.campaign_id]);
    publishEvent('wa_saas:drip_enrolled', { tenantId, phone: data.contact_phone, campaign_id: data.campaign_id });
    return r.rows[0];
  }

  static async listEnrollments(tenantId: string, campaignId?: string) {
    const clauses = ['tenant_id = $1']; const vals: unknown[] = [tenantId]; let idx = 2;
    if (campaignId) { clauses.push(`campaign_id = $${idx++}`); vals.push(campaignId); }
    const r = await query(`SELECT * FROM wa_drip_enrollments WHERE ${clauses.join(' AND ')} ORDER BY enrolled_at DESC`, vals);
    return r.rows;
  }

  static async getPendingEnrollments() {
    const r = await query(
      `SELECT e.*, s.step_order, s.message_type, s.template_name, s.message_body, s.media_url, s.buttons, c.stop_on_reply, c.name as campaign_name
       FROM wa_drip_enrollments e
       JOIN wa_drip_campaigns c ON c.id = e.campaign_id
       JOIN wa_drip_steps s ON s.campaign_id = e.campaign_id AND s.step_order = e.current_step AND s.tenant_id = e.tenant_id
       WHERE e.status = 'active' AND e.next_action_at <= NOW() AND c.is_active = true
       LIMIT 200`
    );
    return r.rows;
  }

  static async advanceEnrollment(id: string, nextStep: number, nextActionAt: string | null) {
    if (nextActionAt) {
      await query(`UPDATE wa_drip_enrollments SET current_step = $2, next_action_at = $3, updated_at = NOW() WHERE id = $1`, [id, nextStep, nextActionAt]);
    } else {
      await query(`UPDATE wa_drip_enrollments SET current_step = $2, status = 'completed', completed_at = NOW(), updated_at = NOW() WHERE id = $1`, [id, nextStep]);
    }
  }

  static async stopEnrollment(id: string, reason: string) {
    await query(`UPDATE wa_drip_enrollments SET status = 'stopped', stopped_reason = $2, updated_at = NOW() WHERE id = $1`, [id, reason]);
  }

  static async logStep(tenantId: string, data: Record<string, unknown>) {
    await query(
      `INSERT INTO wa_drip_logs (tenant_id, enrollment_id, campaign_id, step_order, status, wa_message_id, error)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [tenantId, data.enrollment_id, data.campaign_id, data.step_order, data.status, data.wa_message_id, data.error]
    );
  }

  // ── Analytics ──
  static async getStats(tenantId: string) {
    const r = await query(`
      SELECT
        (SELECT COUNT(*) FROM wa_drip_campaigns WHERE tenant_id = $1) AS campaigns,
        (SELECT COUNT(*) FROM wa_drip_campaigns WHERE tenant_id = $1 AND is_active = true) AS active_campaigns,
        (SELECT COUNT(*) FROM wa_drip_enrollments WHERE tenant_id = $1 AND status = 'active') AS active_enrollments,
        (SELECT COUNT(*) FROM wa_drip_enrollments WHERE tenant_id = $1 AND status = 'completed') AS completed,
        (SELECT COUNT(*) FROM wa_drip_enrollments WHERE tenant_id = $1 AND status = 'stopped') AS stopped,
        (SELECT COUNT(*) FROM wa_drip_logs WHERE tenant_id = $1 AND status = 'sent') AS messages_sent,
        (SELECT COUNT(*) FROM wa_drip_logs WHERE tenant_id = $1 AND status = 'failed') AS messages_failed
    `, [tenantId]);
    return r.rows[0];
  }
}

// ══════════════════════════════════════════════════════════════════════════
//  MODULE 2: AI AUTO-REPLY BOT
// ══════════════════════════════════════════════════════════════════════════
export class AiBotService {
  // ── Config ──
  static async listConfigs(tenantId: string) {
    const r = await query(`SELECT * FROM wa_ai_bot_configs WHERE tenant_id = $1 ORDER BY created_at DESC`, [tenantId]);
    return r.rows;
  }

  static async getConfig(tenantId: string, id: string) {
    const r = await query(`SELECT * FROM wa_ai_bot_configs WHERE id = $1 AND tenant_id = $2`, [id, tenantId]);
    return r.rows[0] || null;
  }

  static async createConfig(tenantId: string, data: Record<string, unknown>) {
    const r = await query(
      `INSERT INTO wa_ai_bot_configs (tenant_id, name, model, system_prompt, temperature, max_tokens, human_takeover_enabled, takeover_keywords, business_hours, fallback_message)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [tenantId, data.name, data.model, data.system_prompt, data.temperature, data.max_tokens, data.human_takeover_enabled, data.takeover_keywords, JSON.stringify(data.business_hours), data.fallback_message]
    );
    return r.rows[0];
  }

  static async updateConfig(tenantId: string, id: string, data: Record<string, unknown>) {
    const sets: string[] = []; const vals: unknown[] = []; let idx = 1;
    for (const [k, v] of Object.entries(data)) {
      if (v === undefined) continue;
      sets.push(`${k} = $${idx++}`);
      vals.push(k === 'business_hours' ? JSON.stringify(v) : k === 'takeover_keywords' ? v : v);
    }
    if (!sets.length) return null;
    sets.push(`updated_at = NOW()`);
    vals.push(id, tenantId);
    const r = await query(`UPDATE wa_ai_bot_configs SET ${sets.join(', ')} WHERE id = $${idx++} AND tenant_id = $${idx} RETURNING *`, vals);
    return r.rows[0] || null;
  }

  static async deleteConfig(tenantId: string, id: string) {
    await query(`DELETE FROM wa_ai_bot_configs WHERE id = $1 AND tenant_id = $2`, [id, tenantId]);
  }

  static async toggleConfig(tenantId: string, id: string) {
    const r = await query(`UPDATE wa_ai_bot_configs SET is_active = NOT is_active, updated_at = NOW() WHERE id = $1 AND tenant_id = $2 RETURNING *`, [id, tenantId]);
    return r.rows[0] || null;
  }

  // ── FAQ ──
  static async listFaqs(tenantId: string, botId?: string) {
    const clauses = ['tenant_id = $1']; const vals: unknown[] = [tenantId]; let idx = 2;
    if (botId) { clauses.push(`bot_config_id = $${idx++}`); vals.push(botId); }
    const r = await query(`SELECT * FROM wa_ai_faq_entries WHERE ${clauses.join(' AND ')} ORDER BY priority DESC, created_at DESC`, vals);
    return r.rows;
  }

  static async createFaq(tenantId: string, data: Record<string, unknown>) {
    const r = await query(
      `INSERT INTO wa_ai_faq_entries (tenant_id, bot_config_id, question, answer, keywords, priority) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [tenantId, data.bot_config_id, data.question, data.answer, data.keywords, data.priority]
    );
    return r.rows[0];
  }

  static async updateFaq(tenantId: string, id: string, data: Record<string, unknown>) {
    const sets: string[] = []; const vals: unknown[] = []; let idx = 1;
    for (const [k, v] of Object.entries(data)) {
      if (v === undefined) continue;
      sets.push(`${k} = $${idx++}`); vals.push(v);
    }
    if (!sets.length) return null;
    vals.push(id, tenantId);
    const r = await query(`UPDATE wa_ai_faq_entries SET ${sets.join(', ')} WHERE id = $${idx++} AND tenant_id = $${idx} RETURNING *`, vals);
    return r.rows[0] || null;
  }

  static async deleteFaq(tenantId: string, id: string) {
    await query(`DELETE FROM wa_ai_faq_entries WHERE id = $1 AND tenant_id = $2`, [id, tenantId]);
  }

  // ── Conversations ──
  static async listConversations(tenantId: string, botId?: string, status?: string) {
    const clauses = ['tenant_id = $1']; const vals: unknown[] = [tenantId]; let idx = 2;
    if (botId) { clauses.push(`bot_config_id = $${idx++}`); vals.push(botId); }
    if (status) { clauses.push(`status = $${idx++}`); vals.push(status); }
    const r = await query(`SELECT * FROM wa_ai_conversations WHERE ${clauses.join(' AND ')} ORDER BY last_message_at DESC`, vals);
    return r.rows;
  }

  static async getConversation(tenantId: string, id: string) {
    const r = await query(`SELECT * FROM wa_ai_conversations WHERE id = $1 AND tenant_id = $2`, [id, tenantId]);
    return r.rows[0] || null;
  }

  static async conversationAction(tenantId: string, id: string, action: string, agentId?: string) {
    if (action === 'takeover') {
      const r = await query(`UPDATE wa_ai_conversations SET status = 'human', assigned_agent = $3, takeover_at = NOW(), updated_at = NOW() WHERE id = $1 AND tenant_id = $2 RETURNING *`, [id, tenantId, agentId]);
      publishEvent('wa_saas:human_takeover', { tenantId, conversation_id: id });
      return r.rows[0];
    } else if (action === 'release') {
      const r = await query(`UPDATE wa_ai_conversations SET status = 'bot', assigned_agent = NULL, updated_at = NOW() WHERE id = $1 AND tenant_id = $2 RETURNING *`, [id, tenantId]);
      return r.rows[0];
    } else {
      const r = await query(`UPDATE wa_ai_conversations SET status = 'closed', updated_at = NOW() WHERE id = $1 AND tenant_id = $2 RETURNING *`, [id, tenantId]);
      return r.rows[0];
    }
  }

  static async listSuggestions(tenantId: string, conversationId: string) {
    const r = await query(`SELECT * FROM wa_ai_suggestions WHERE conversation_id = $1 AND tenant_id = $2 ORDER BY created_at DESC LIMIT 10`, [conversationId, tenantId]);
    return r.rows;
  }

  static async getStats(tenantId: string) {
    const r = await query(`
      SELECT
        (SELECT COUNT(*) FROM wa_ai_bot_configs WHERE tenant_id = $1) AS bots,
        (SELECT COUNT(*) FROM wa_ai_bot_configs WHERE tenant_id = $1 AND is_active = true) AS active_bots,
        (SELECT COUNT(*) FROM wa_ai_conversations WHERE tenant_id = $1) AS total_conversations,
        (SELECT COUNT(*) FROM wa_ai_conversations WHERE tenant_id = $1 AND status = 'bot') AS bot_conversations,
        (SELECT COUNT(*) FROM wa_ai_conversations WHERE tenant_id = $1 AND status = 'human') AS human_conversations,
        (SELECT COUNT(*) FROM wa_ai_faq_entries WHERE tenant_id = $1) AS faq_entries,
        (SELECT COALESCE(SUM(hit_count), 0) FROM wa_ai_faq_entries WHERE tenant_id = $1) AS faq_hits
    `, [tenantId]);
    return r.rows[0];
  }
}

// ══════════════════════════════════════════════════════════════════════════
//  MODULE 3: ORDER TRACKING
// ══════════════════════════════════════════════════════════════════════════
export class OrderTrackingService {
  static async listConfigs(tenantId: string) {
    const r = await query(`SELECT * FROM wa_order_configs WHERE tenant_id = $1 ORDER BY created_at DESC`, [tenantId]);
    return r.rows;
  }

  static async createConfig(tenantId: string, data: Record<string, unknown>) {
    const r = await query(
      `INSERT INTO wa_order_configs (tenant_id, name, shipping_provider, notify_on_shipped, notify_on_out_for_delivery, notify_on_delivered, notify_on_delay, delay_threshold_hours, message_templates)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [tenantId, data.name, data.shipping_provider, data.notify_on_shipped, data.notify_on_out_for_delivery, data.notify_on_delivered, data.notify_on_delay, data.delay_threshold_hours, JSON.stringify(data.message_templates)]
    );
    return r.rows[0];
  }

  static async updateConfig(tenantId: string, id: string, data: Record<string, unknown>) {
    const sets: string[] = []; const vals: unknown[] = []; let idx = 1;
    for (const [k, v] of Object.entries(data)) {
      if (v === undefined) continue;
      sets.push(`${k} = $${idx++}`);
      vals.push(k === 'message_templates' ? JSON.stringify(v) : v);
    }
    if (!sets.length) return null;
    sets.push(`updated_at = NOW()`);
    vals.push(id, tenantId);
    const r = await query(`UPDATE wa_order_configs SET ${sets.join(', ')} WHERE id = $${idx++} AND tenant_id = $${idx} RETURNING *`, vals);
    return r.rows[0] || null;
  }

  static async deleteConfig(tenantId: string, id: string) {
    await query(`DELETE FROM wa_order_configs WHERE id = $1 AND tenant_id = $2`, [id, tenantId]);
  }

  // ── Orders ──
  static async listOrders(tenantId: string, status?: string) {
    const clauses = ['tenant_id = $1']; const vals: unknown[] = [tenantId]; let idx = 2;
    if (status) { clauses.push(`status = $${idx++}`); vals.push(status); }
    const r = await query(`SELECT * FROM wa_orders WHERE ${clauses.join(' AND ')} ORDER BY created_at DESC`, vals);
    return r.rows;
  }

  static async getOrder(tenantId: string, id: string) {
    const r = await query(`SELECT * FROM wa_orders WHERE id = $1 AND tenant_id = $2`, [id, tenantId]);
    return r.rows[0] || null;
  }

  static async createOrder(tenantId: string, data: Record<string, unknown>) {
    const r = await query(
      `INSERT INTO wa_orders (tenant_id, config_id, order_number, customer_phone, customer_name, tracking_number, tracking_url, carrier, estimated_delivery, metadata)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [tenantId, data.config_id, data.order_number, data.customer_phone, data.customer_name, data.tracking_number, data.tracking_url, data.carrier, data.estimated_delivery, JSON.stringify(data.metadata)]
    );
    publishEvent('wa_saas:order_created', { tenantId, order_number: data.order_number });
    return r.rows[0];
  }

  static async updateOrder(tenantId: string, id: string, data: Record<string, unknown>) {
    const sets: string[] = []; const vals: unknown[] = []; let idx = 1;
    for (const [k, v] of Object.entries(data)) {
      if (v === undefined) continue;
      sets.push(`${k} = $${idx++}`);
      vals.push(k === 'metadata' ? JSON.stringify(v) : v);
    }
    if (!sets.length) return null;
    sets.push(`updated_at = NOW()`);
    vals.push(id, tenantId);
    const r = await query(`UPDATE wa_orders SET ${sets.join(', ')} WHERE id = $${idx++} AND tenant_id = $${idx} RETURNING *`, vals);
    if (r.rows[0] && data.status) {
      publishEvent('wa_saas:order_status', { tenantId, order_id: id, status: data.status });
    }
    return r.rows[0] || null;
  }

  static async addEvent(tenantId: string, data: Record<string, unknown>) {
    const r = await query(
      `INSERT INTO wa_order_events (tenant_id, order_id, event_type, description, location) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [tenantId, data.order_id, data.event_type, data.description, data.location]
    );
    return r.rows[0];
  }

  static async listEvents(tenantId: string, orderId: string) {
    const r = await query(`SELECT * FROM wa_order_events WHERE order_id = $1 AND tenant_id = $2 ORDER BY occurred_at DESC`, [orderId, tenantId]);
    return r.rows;
  }

  static async getDelayedOrders() {
    const r = await query(
      `SELECT o.*, c.delay_threshold_hours, c.message_templates
       FROM wa_orders o
       JOIN wa_order_configs c ON c.id = o.config_id AND c.tenant_id = o.tenant_id
       WHERE o.status IN ('shipped', 'out_for_delivery')
         AND c.notify_on_delay = true
         AND o.estimated_delivery < NOW()
         AND (o.last_notified_status IS NULL OR o.last_notified_status != 'delay_alert')
       LIMIT 100`
    );
    return r.rows;
  }

  static async getStats(tenantId: string) {
    const r = await query(`
      SELECT
        (SELECT COUNT(*) FROM wa_orders WHERE tenant_id = $1) AS total_orders,
        (SELECT COUNT(*) FROM wa_orders WHERE tenant_id = $1 AND status = 'pending') AS pending,
        (SELECT COUNT(*) FROM wa_orders WHERE tenant_id = $1 AND status = 'shipped') AS shipped,
        (SELECT COUNT(*) FROM wa_orders WHERE tenant_id = $1 AND status = 'delivered') AS delivered,
        (SELECT COUNT(*) FROM wa_orders WHERE tenant_id = $1 AND status = 'out_for_delivery') AS out_for_delivery,
        (SELECT COALESCE(SUM(notification_count), 0) FROM wa_orders WHERE tenant_id = $1) AS notifications_sent
    `, [tenantId]);
    return r.rows[0];
  }
}

// ══════════════════════════════════════════════════════════════════════════
//  MODULE 4: SUBSCRIPTION BOT
// ══════════════════════════════════════════════════════════════════════════
export class SubscriptionBotService {
  static async listPlans(tenantId: string) {
    const r = await query(`SELECT * FROM wa_subscription_plans WHERE tenant_id = $1 ORDER BY created_at DESC`, [tenantId]);
    return r.rows;
  }

  static async createPlan(tenantId: string, data: Record<string, unknown>) {
    const r = await query(
      `INSERT INTO wa_subscription_plans (tenant_id, name, description, price, currency, billing_cycle, grace_period_days, reminder_days_before, auto_pause_on_fail)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [tenantId, data.name, data.description, data.price, data.currency, data.billing_cycle, data.grace_period_days, data.reminder_days_before, data.auto_pause_on_fail]
    );
    return r.rows[0];
  }

  static async updatePlan(tenantId: string, id: string, data: Record<string, unknown>) {
    const sets: string[] = []; const vals: unknown[] = []; let idx = 1;
    for (const [k, v] of Object.entries(data)) {
      if (v === undefined) continue;
      sets.push(`${k} = $${idx++}`); vals.push(v);
    }
    if (!sets.length) return null;
    sets.push(`updated_at = NOW()`);
    vals.push(id, tenantId);
    const r = await query(`UPDATE wa_subscription_plans SET ${sets.join(', ')} WHERE id = $${idx++} AND tenant_id = $${idx} RETURNING *`, vals);
    return r.rows[0] || null;
  }

  static async deletePlan(tenantId: string, id: string) {
    await query(`DELETE FROM wa_subscription_plans WHERE id = $1 AND tenant_id = $2`, [id, tenantId]);
  }

  // ── Subscriptions ──
  static async listSubscriptions(tenantId: string, planId?: string, status?: string) {
    const clauses = ['tenant_id = $1']; const vals: unknown[] = [tenantId]; let idx = 2;
    if (planId) { clauses.push(`plan_id = $${idx++}`); vals.push(planId); }
    if (status) { clauses.push(`status = $${idx++}`); vals.push(status); }
    const r = await query(`SELECT s.*, p.name as plan_name, p.price, p.billing_cycle FROM wa_subscriptions s JOIN wa_subscription_plans p ON p.id = s.plan_id WHERE ${clauses.map(c => 's.' + c.replace('tenant_id', 'tenant_id')).join(' AND ')} ORDER BY s.created_at DESC`.replace(/s\.tenant_id/g, 's.tenant_id').replace(/s\.plan_id/g, 's.plan_id').replace(/s\.status/g, 's.status'), vals);
    return r.rows;
  }

  static async createSubscription(tenantId: string, data: Record<string, unknown>) {
    const { rows: plans } = await query(`SELECT billing_cycle FROM wa_subscription_plans WHERE id = $1 AND tenant_id = $2`, [data.plan_id, tenantId]);
    if (!plans.length) throw new Error('Plan not found');
    const cycle = plans[0].billing_cycle as string;
    const intervalMap: Record<string, string> = { weekly: '7 days', monthly: '1 month', quarterly: '3 months', yearly: '1 year' };
    const interval = intervalMap[cycle] || '1 month';
    const r = await query(
      `INSERT INTO wa_subscriptions (tenant_id, plan_id, customer_phone, customer_name, customer_email, payment_method, current_period_start, current_period_end, next_billing_at)
       VALUES ($1,$2,$3,$4,$5,$6, NOW(), NOW() + $7::interval, NOW() + $7::interval) RETURNING *`,
      [tenantId, data.plan_id, data.customer_phone, data.customer_name, data.customer_email, JSON.stringify(data.payment_method), interval]
    );
    await query(`UPDATE wa_subscription_plans SET subscriber_count = subscriber_count + 1 WHERE id = $1`, [data.plan_id]);
    publishEvent('wa_saas:subscription_created', { tenantId, phone: data.customer_phone });
    return r.rows[0];
  }

  static async subscriptionAction(tenantId: string, id: string, action: string) {
    if (action === 'pause') {
      const r = await query(`UPDATE wa_subscriptions SET status = 'paused', paused_at = NOW(), updated_at = NOW() WHERE id = $1 AND tenant_id = $2 RETURNING *`, [id, tenantId]);
      return r.rows[0];
    } else if (action === 'resume') {
      const r = await query(`UPDATE wa_subscriptions SET status = 'active', paused_at = NULL, updated_at = NOW() WHERE id = $1 AND tenant_id = $2 RETURNING *`, [id, tenantId]);
      return r.rows[0];
    } else {
      const r = await query(`UPDATE wa_subscriptions SET status = 'cancelled', cancelled_at = NOW(), updated_at = NOW() WHERE id = $1 AND tenant_id = $2 RETURNING *`, [id, tenantId]);
      return r.rows[0];
    }
  }

  static async recordPayment(tenantId: string, data: Record<string, unknown>) {
    const r = await query(
      `INSERT INTO wa_subscription_payments (tenant_id, subscription_id, amount, currency, payment_ref, status, paid_at) VALUES ($1,$2,$3,$4,$5,'paid',NOW()) RETURNING *`,
      [tenantId, data.subscription_id, data.amount, data.currency, data.payment_ref]
    );
    await query(`UPDATE wa_subscriptions SET total_paid = total_paid + $2, updated_at = NOW() WHERE id = $1`, [data.subscription_id, data.amount]);
    publishEvent('wa_saas:payment_received', { tenantId, subscription_id: data.subscription_id, amount: data.amount });
    return r.rows[0];
  }

  static async getDueReminders() {
    const r = await query(
      `SELECT s.*, p.name as plan_name, p.reminder_days_before, p.billing_cycle
       FROM wa_subscriptions s
       JOIN wa_subscription_plans p ON p.id = s.plan_id
       WHERE s.status = 'active' AND s.next_billing_at IS NOT NULL
         AND s.next_billing_at <= NOW() + INTERVAL '7 days'
       LIMIT 200`
    );
    return r.rows;
  }

  static async getStats(tenantId: string) {
    const r = await query(`
      SELECT
        (SELECT COUNT(*) FROM wa_subscription_plans WHERE tenant_id = $1) AS plans,
        (SELECT COUNT(*) FROM wa_subscriptions WHERE tenant_id = $1) AS total_subs,
        (SELECT COUNT(*) FROM wa_subscriptions WHERE tenant_id = $1 AND status = 'active') AS active_subs,
        (SELECT COUNT(*) FROM wa_subscriptions WHERE tenant_id = $1 AND status = 'paused') AS paused_subs,
        (SELECT COALESCE(SUM(total_paid), 0) FROM wa_subscriptions WHERE tenant_id = $1) AS total_revenue,
        (SELECT COUNT(*) FROM wa_subscription_payments WHERE tenant_id = $1) AS total_payments
    `, [tenantId]);
    return r.rows[0];
  }
}

// ══════════════════════════════════════════════════════════════════════════
//  MODULE 5: FLASH SALE
// ══════════════════════════════════════════════════════════════════════════
export class FlashSaleService {
  static async list(tenantId: string) {
    const r = await query(`SELECT * FROM wa_flash_sales WHERE tenant_id = $1 ORDER BY created_at DESC`, [tenantId]);
    return r.rows;
  }

  static async get(tenantId: string, id: string) {
    const r = await query(`SELECT * FROM wa_flash_sales WHERE id = $1 AND tenant_id = $2`, [id, tenantId]);
    return r.rows[0] || null;
  }

  static async create(tenantId: string, data: Record<string, unknown>) {
    const r = await query(
      `INSERT INTO wa_flash_sales (tenant_id, name, description, offer_text, discount_code, starts_at, ends_at, segment_filter, send_countdown, countdown_intervals, final_reminder_min, template_name, media_url)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
      [tenantId, data.name, data.description, data.offer_text, data.discount_code, data.starts_at, data.ends_at, JSON.stringify(data.segment_filter), data.send_countdown, data.countdown_intervals, data.final_reminder_min, data.template_name, data.media_url]
    );
    return r.rows[0];
  }

  static async update(tenantId: string, id: string, data: Record<string, unknown>) {
    const sets: string[] = []; const vals: unknown[] = []; let idx = 1;
    for (const [k, v] of Object.entries(data)) {
      if (v === undefined) continue;
      sets.push(`${k} = $${idx++}`);
      vals.push(k === 'segment_filter' ? JSON.stringify(v) : v);
    }
    if (!sets.length) return null;
    sets.push(`updated_at = NOW()`);
    vals.push(id, tenantId);
    const r = await query(`UPDATE wa_flash_sales SET ${sets.join(', ')} WHERE id = $${idx++} AND tenant_id = $${idx} RETURNING *`, vals);
    return r.rows[0] || null;
  }

  static async delete(tenantId: string, id: string) {
    await query(`DELETE FROM wa_flash_sales WHERE id = $1 AND tenant_id = $2`, [id, tenantId]);
  }

  static async action(tenantId: string, id: string, action: string) {
    const statusMap: Record<string, string> = { activate: 'active', pause: 'paused', cancel: 'cancelled' };
    const r = await query(`UPDATE wa_flash_sales SET status = $3, updated_at = NOW() WHERE id = $1 AND tenant_id = $2 RETURNING *`, [id, tenantId, statusMap[action] || action]);
    return r.rows[0] || null;
  }

  static async listRecipients(tenantId: string, saleId: string) {
    const r = await query(`SELECT * FROM wa_flash_sale_recipients WHERE sale_id = $1 AND tenant_id = $2 ORDER BY sent_at DESC`, [saleId, tenantId]);
    return r.rows;
  }

  static async getActiveSales() {
    const r = await query(
      `SELECT * FROM wa_flash_sales WHERE status = 'active' AND starts_at <= NOW() AND ends_at > NOW() LIMIT 100`
    );
    return r.rows;
  }

  static async getStats(tenantId: string) {
    const r = await query(`
      SELECT
        (SELECT COUNT(*) FROM wa_flash_sales WHERE tenant_id = $1) AS total_sales,
        (SELECT COUNT(*) FROM wa_flash_sales WHERE tenant_id = $1 AND status = 'active') AS active_sales,
        (SELECT COALESCE(SUM(sent_count), 0) FROM wa_flash_sales WHERE tenant_id = $1) AS total_sent,
        (SELECT COALESCE(SUM(click_count), 0) FROM wa_flash_sales WHERE tenant_id = $1) AS total_clicks,
        (SELECT COALESCE(SUM(conversion_count), 0) FROM wa_flash_sales WHERE tenant_id = $1) AS total_conversions
    `, [tenantId]);
    return r.rows[0];
  }
}

// ══════════════════════════════════════════════════════════════════════════
//  MODULE 6: TEAM INBOX
// ══════════════════════════════════════════════════════════════════════════
export class TeamInboxService {
  // ── Agents ──
  static async listAgents(tenantId: string) {
    const r = await query(`SELECT * FROM wa_team_agents WHERE tenant_id = $1 ORDER BY name`, [tenantId]);
    return r.rows;
  }

  static async createAgent(tenantId: string, data: Record<string, unknown>) {
    const r = await query(
      `INSERT INTO wa_team_agents (tenant_id, name, email, role, max_concurrent) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [tenantId, data.name, data.email, data.role, data.max_concurrent]
    );
    return r.rows[0];
  }

  static async updateAgent(tenantId: string, id: string, data: Record<string, unknown>) {
    const sets: string[] = []; const vals: unknown[] = []; let idx = 1;
    for (const [k, v] of Object.entries(data)) {
      if (v === undefined) continue;
      sets.push(`${k} = $${idx++}`); vals.push(v);
    }
    if (!sets.length) return null;
    sets.push(`updated_at = NOW()`);
    vals.push(id, tenantId);
    const r = await query(`UPDATE wa_team_agents SET ${sets.join(', ')} WHERE id = $${idx++} AND tenant_id = $${idx} RETURNING *`, vals);
    return r.rows[0] || null;
  }

  static async deleteAgent(tenantId: string, id: string) {
    await query(`DELETE FROM wa_team_agents WHERE id = $1 AND tenant_id = $2`, [id, tenantId]);
  }

  static async setAgentOnline(tenantId: string, id: string, online: boolean) {
    await query(`UPDATE wa_team_agents SET is_online = $3, updated_at = NOW() WHERE id = $1 AND tenant_id = $2`, [id, tenantId, online]);
  }

  // ── Conversations ──
  static async listConversations(tenantId: string, status?: string, agentId?: string) {
    const clauses = ['tenant_id = $1']; const vals: unknown[] = [tenantId]; let idx = 2;
    if (status) { clauses.push(`status = $${idx++}`); vals.push(status); }
    if (agentId) { clauses.push(`assigned_agent_id = $${idx++}`); vals.push(agentId); }
    const r = await query(`SELECT * FROM wa_team_conversations WHERE ${clauses.join(' AND ')} ORDER BY last_message_at DESC`, vals);
    return r.rows;
  }

  static async getConversation(tenantId: string, id: string) {
    const r = await query(`SELECT * FROM wa_team_conversations WHERE id = $1 AND tenant_id = $2`, [id, tenantId]);
    return r.rows[0] || null;
  }

  static async assignConversation(tenantId: string, id: string, agentId: string | null, priority?: string) {
    const sets = ['assigned_agent_id = $3', 'updated_at = NOW()'];
    const vals: unknown[] = [id, tenantId, agentId];
    if (priority) { sets.push(`priority = $4`); vals.push(priority); }
    const r = await query(`UPDATE wa_team_conversations SET ${sets.join(', ')} WHERE id = $1 AND tenant_id = $2 RETURNING *`, vals);
    publishEvent('wa_saas:conversation_assigned', { tenantId, conversation_id: id, agent_id: agentId });
    return r.rows[0] || null;
  }

  static async addTags(tenantId: string, id: string, tags: string[]) {
    const r = await query(`UPDATE wa_team_conversations SET tags = array_cat(tags, $3), updated_at = NOW() WHERE id = $1 AND tenant_id = $2 RETURNING *`, [id, tenantId, tags]);
    return r.rows[0] || null;
  }

  static async resolveConversation(tenantId: string, id: string) {
    const r = await query(`UPDATE wa_team_conversations SET status = 'resolved', resolved_at = NOW(), updated_at = NOW() WHERE id = $1 AND tenant_id = $2 RETURNING *`, [id, tenantId]);
    return r.rows[0] || null;
  }

  // ── Messages ──
  static async listMessages(tenantId: string, conversationId: string) {
    const r = await query(`SELECT * FROM wa_team_messages WHERE conversation_id = $1 AND tenant_id = $2 ORDER BY created_at ASC`, [conversationId, tenantId]);
    return r.rows;
  }

  static async sendReply(tenantId: string, data: Record<string, unknown>) {
    const r = await query(
      `INSERT INTO wa_team_messages (tenant_id, conversation_id, direction, sender_type, sender_id, body, message_type, media_url)
       VALUES ($1,$2,'outbound','agent',$3,$4,$5,$6) RETURNING *`,
      [tenantId, data.conversation_id, data.agent_id, data.body, data.message_type, data.media_url]
    );
    await query(`UPDATE wa_team_conversations SET last_message_at = NOW(), last_message_preview = $2, message_count = message_count + 1 WHERE id = $1`, [data.conversation_id, String(data.body).slice(0, 100)]);
    return r.rows[0];
  }

  // ── Notes ──
  static async listNotes(tenantId: string, conversationId: string) {
    const r = await query(`SELECT * FROM wa_team_notes WHERE conversation_id = $1 AND tenant_id = $2 ORDER BY created_at DESC`, [conversationId, tenantId]);
    return r.rows;
  }

  static async addNote(tenantId: string, data: Record<string, unknown>) {
    const r = await query(
      `INSERT INTO wa_team_notes (tenant_id, conversation_id, agent_id, note) VALUES ($1,$2,$3,$4) RETURNING *`,
      [tenantId, data.conversation_id, data.agent_id, data.note]
    );
    return r.rows[0];
  }

  static async getSlaBreached() {
    const r = await query(
      `SELECT * FROM wa_team_conversations WHERE status = 'open' AND sla_deadline IS NOT NULL AND sla_deadline < NOW() AND sla_breached = false LIMIT 100`
    );
    return r.rows;
  }

  static async getStats(tenantId: string) {
    const r = await query(`
      SELECT
        (SELECT COUNT(*) FROM wa_team_agents WHERE tenant_id = $1 AND is_active = true) AS agents,
        (SELECT COUNT(*) FROM wa_team_agents WHERE tenant_id = $1 AND is_online = true) AS online_agents,
        (SELECT COUNT(*) FROM wa_team_conversations WHERE tenant_id = $1 AND status = 'open') AS open_conversations,
        (SELECT COUNT(*) FROM wa_team_conversations WHERE tenant_id = $1 AND status = 'resolved') AS resolved,
        (SELECT COUNT(*) FROM wa_team_conversations WHERE tenant_id = $1 AND sla_breached = true) AS sla_breached,
        (SELECT COALESCE(AVG(EXTRACT(EPOCH FROM (first_response_at - created_at))), 0) FROM wa_team_conversations WHERE tenant_id = $1 AND first_response_at IS NOT NULL) AS avg_first_response_sec
    `, [tenantId]);
    return r.rows[0];
  }
}

// ══════════════════════════════════════════════════════════════════════════
//  MODULE 7: LINK TRACKING
// ══════════════════════════════════════════════════════════════════════════
export class LinkTrackingService {
  static async list(tenantId: string) {
    const r = await query(`SELECT * FROM wa_tracked_links WHERE tenant_id = $1 ORDER BY created_at DESC`, [tenantId]);
    return r.rows;
  }

  static async get(tenantId: string, id: string) {
    const r = await query(`SELECT * FROM wa_tracked_links WHERE id = $1 AND tenant_id = $2`, [id, tenantId]);
    return r.rows[0] || null;
  }

  static async create(tenantId: string, data: Record<string, unknown>) {
    const shortCode = Math.random().toString(36).substring(2, 10);
    const r = await query(
      `INSERT INTO wa_tracked_links (tenant_id, name, original_url, short_code, campaign_ref, expires_at) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [tenantId, data.name, data.original_url, shortCode, data.campaign_ref, data.expires_at]
    );
    return r.rows[0];
  }

  static async update(tenantId: string, id: string, data: Record<string, unknown>) {
    const sets: string[] = []; const vals: unknown[] = []; let idx = 1;
    for (const [k, v] of Object.entries(data)) {
      if (v === undefined) continue;
      sets.push(`${k} = $${idx++}`); vals.push(v);
    }
    if (!sets.length) return null;
    vals.push(id, tenantId);
    const r = await query(`UPDATE wa_tracked_links SET ${sets.join(', ')} WHERE id = $${idx++} AND tenant_id = $${idx} RETURNING *`, vals);
    return r.rows[0] || null;
  }

  static async delete(tenantId: string, id: string) {
    await query(`DELETE FROM wa_tracked_links WHERE id = $1 AND tenant_id = $2`, [id, tenantId]);
  }

  static async resolveShortCode(code: string) {
    const r = await query(`SELECT * FROM wa_tracked_links WHERE short_code = $1 AND is_active = true`, [code]);
    return r.rows[0] || null;
  }

  static async recordClick(tenantId: string, linkId: string, data: Record<string, unknown>) {
    await query(
      `INSERT INTO wa_link_clicks (tenant_id, link_id, contact_phone, ip_address, user_agent, referer) VALUES ($1,$2,$3,$4,$5,$6)`,
      [tenantId, linkId, data.contact_phone, data.ip_address, data.user_agent, data.referer]
    );
    await query(`UPDATE wa_tracked_links SET total_clicks = total_clicks + 1 WHERE id = $1`, [linkId]);
  }

  static async recordConversion(tenantId: string, linkId: string, phone?: string, value?: number) {
    await query(`UPDATE wa_link_clicks SET converted = true, conversion_value = $3 WHERE link_id = $1 AND contact_phone = $2 AND converted = false`, [linkId, phone, value]);
    await query(`UPDATE wa_tracked_links SET conversions = conversions + 1 WHERE id = $1`, [linkId]);
  }

  static async getClickStats(tenantId: string, linkId: string) {
    const r = await query(
      `SELECT COUNT(*) AS total_clicks, COUNT(DISTINCT contact_phone) AS unique_clicks, COUNT(*) FILTER (WHERE converted) AS conversions, COALESCE(SUM(conversion_value) FILTER (WHERE converted), 0) AS conversion_value
       FROM wa_link_clicks WHERE link_id = $1 AND tenant_id = $2`,
      [linkId, tenantId]
    );
    return r.rows[0];
  }

  static async getStats(tenantId: string) {
    const r = await query(`
      SELECT
        (SELECT COUNT(*) FROM wa_tracked_links WHERE tenant_id = $1) AS total_links,
        (SELECT COUNT(*) FROM wa_tracked_links WHERE tenant_id = $1 AND is_active = true) AS active_links,
        (SELECT COALESCE(SUM(total_clicks), 0) FROM wa_tracked_links WHERE tenant_id = $1) AS total_clicks,
        (SELECT COALESCE(SUM(unique_clicks), 0) FROM wa_tracked_links WHERE tenant_id = $1) AS unique_clicks,
        (SELECT COALESCE(SUM(conversions), 0) FROM wa_tracked_links WHERE tenant_id = $1) AS total_conversions
    `, [tenantId]);
    return r.rows[0];
  }
}

// ══════════════════════════════════════════════════════════════════════════
//  MODULE 8: RE-ENGAGEMENT
// ══════════════════════════════════════════════════════════════════════════
export class ReengagementService {
  static async list(tenantId: string) {
    const r = await query(`SELECT * FROM wa_reengagement_campaigns WHERE tenant_id = $1 ORDER BY created_at DESC`, [tenantId]);
    return r.rows;
  }

  static async get(tenantId: string, id: string) {
    const r = await query(`SELECT * FROM wa_reengagement_campaigns WHERE id = $1 AND tenant_id = $2`, [id, tenantId]);
    return r.rows[0] || null;
  }

  static async create(tenantId: string, data: Record<string, unknown>) {
    const r = await query(
      `INSERT INTO wa_reengagement_campaigns (tenant_id, name, description, inactivity_days, segment_filter, message_type, template_name, message_body, offer_code, media_url)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [tenantId, data.name, data.description, data.inactivity_days, JSON.stringify(data.segment_filter), data.message_type, data.template_name, data.message_body, data.offer_code, data.media_url]
    );
    return r.rows[0];
  }

  static async update(tenantId: string, id: string, data: Record<string, unknown>) {
    const sets: string[] = []; const vals: unknown[] = []; let idx = 1;
    for (const [k, v] of Object.entries(data)) {
      if (v === undefined) continue;
      sets.push(`${k} = $${idx++}`);
      vals.push(k === 'segment_filter' ? JSON.stringify(v) : v);
    }
    if (!sets.length) return null;
    sets.push(`updated_at = NOW()`);
    vals.push(id, tenantId);
    const r = await query(`UPDATE wa_reengagement_campaigns SET ${sets.join(', ')} WHERE id = $${idx++} AND tenant_id = $${idx} RETURNING *`, vals);
    return r.rows[0] || null;
  }

  static async delete(tenantId: string, id: string) {
    await query(`DELETE FROM wa_reengagement_campaigns WHERE id = $1 AND tenant_id = $2`, [id, tenantId]);
  }

  static async action(tenantId: string, id: string, action: string) {
    const statusMap: Record<string, string> = { activate: 'active', pause: 'paused', cancel: 'cancelled' };
    const r = await query(`UPDATE wa_reengagement_campaigns SET status = $3, updated_at = NOW() WHERE id = $1 AND tenant_id = $2 RETURNING *`, [id, tenantId, statusMap[action] || action]);
    return r.rows[0] || null;
  }

  static async listContacts(tenantId: string, campaignId: string) {
    const r = await query(`SELECT * FROM wa_reengagement_contacts WHERE campaign_id = $1 AND tenant_id = $2 ORDER BY sent_at DESC NULLS LAST`, [campaignId, tenantId]);
    return r.rows;
  }

  static async getActiveForProcessing() {
    const r = await query(
      `SELECT * FROM wa_reengagement_campaigns WHERE status = 'active' AND is_active = true LIMIT 50`
    );
    return r.rows;
  }

  static async getStats(tenantId: string) {
    const r = await query(`
      SELECT
        (SELECT COUNT(*) FROM wa_reengagement_campaigns WHERE tenant_id = $1) AS total_campaigns,
        (SELECT COUNT(*) FROM wa_reengagement_campaigns WHERE tenant_id = $1 AND status = 'active') AS active_campaigns,
        (SELECT COALESCE(SUM(sent_count), 0) FROM wa_reengagement_campaigns WHERE tenant_id = $1) AS total_sent,
        (SELECT COALESCE(SUM(reengaged_count), 0) FROM wa_reengagement_campaigns WHERE tenant_id = $1) AS total_reengaged
    `, [tenantId]);
    return r.rows[0];
  }
}

// ══════════════════════════════════════════════════════════════════════════
//  MODULE 9: BROADCAST OPTIMIZER
// ══════════════════════════════════════════════════════════════════════════
export class BroadcastOptimizerService {
  static async listConfigs(tenantId: string) {
    const r = await query(`SELECT * FROM wa_broadcast_optimizer_configs WHERE tenant_id = $1 ORDER BY created_at DESC`, [tenantId]);
    return r.rows;
  }

  static async createConfig(tenantId: string, data: Record<string, unknown>) {
    const r = await query(
      `INSERT INTO wa_broadcast_optimizer_configs (tenant_id, name, smart_timing_enabled, timezone, preferred_hours, rate_limit_per_sec, rate_limit_per_min, template_rotation_enabled, templates)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [tenantId, data.name, data.smart_timing_enabled, data.timezone, JSON.stringify(data.preferred_hours), data.rate_limit_per_sec, data.rate_limit_per_min, data.template_rotation_enabled, JSON.stringify(data.templates)]
    );
    return r.rows[0];
  }

  static async updateConfig(tenantId: string, id: string, data: Record<string, unknown>) {
    const sets: string[] = []; const vals: unknown[] = []; let idx = 1;
    for (const [k, v] of Object.entries(data)) {
      if (v === undefined) continue;
      sets.push(`${k} = $${idx++}`);
      vals.push(k === 'preferred_hours' || k === 'templates' ? JSON.stringify(v) : v);
    }
    if (!sets.length) return null;
    sets.push(`updated_at = NOW()`);
    vals.push(id, tenantId);
    const r = await query(`UPDATE wa_broadcast_optimizer_configs SET ${sets.join(', ')} WHERE id = $${idx++} AND tenant_id = $${idx} RETURNING *`, vals);
    return r.rows[0] || null;
  }

  static async deleteConfig(tenantId: string, id: string) {
    await query(`DELETE FROM wa_broadcast_optimizer_configs WHERE id = $1 AND tenant_id = $2`, [id, tenantId]);
  }

  // ── Batches ──
  static async listBatches(tenantId: string, status?: string) {
    const clauses = ['tenant_id = $1']; const vals: unknown[] = [tenantId]; let idx = 2;
    if (status) { clauses.push(`status = $${idx++}`); vals.push(status); }
    const r = await query(`SELECT * FROM wa_broadcast_batches WHERE ${clauses.join(' AND ')} ORDER BY created_at DESC`, vals);
    return r.rows;
  }

  static async createBatch(tenantId: string, data: Record<string, unknown>) {
    const r = await query(
      `INSERT INTO wa_broadcast_batches (tenant_id, config_id, name, template_name, message_body, segment_filter, scheduled_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [tenantId, data.config_id, data.name, data.template_name, data.message_body, JSON.stringify(data.segment_filter), data.scheduled_at]
    );
    return r.rows[0];
  }

  static async updateBatch(tenantId: string, id: string, data: Record<string, unknown>) {
    const sets: string[] = []; const vals: unknown[] = []; let idx = 1;
    for (const [k, v] of Object.entries(data)) {
      if (v === undefined) continue;
      sets.push(`${k} = $${idx++}`);
      vals.push(k === 'segment_filter' ? JSON.stringify(v) : v);
    }
    if (!sets.length) return null;
    sets.push(`updated_at = NOW()`);
    vals.push(id, tenantId);
    const r = await query(`UPDATE wa_broadcast_batches SET ${sets.join(', ')} WHERE id = $${idx++} AND tenant_id = $${idx} RETURNING *`, vals);
    return r.rows[0] || null;
  }

  static async deleteBatch(tenantId: string, id: string) {
    await query(`DELETE FROM wa_broadcast_batches WHERE id = $1 AND tenant_id = $2`, [id, tenantId]);
  }

  static async getScheduledBatches() {
    const r = await query(`SELECT * FROM wa_broadcast_batches WHERE status = 'scheduled' AND scheduled_at <= NOW() LIMIT 50`);
    return r.rows;
  }

  static async getStats(tenantId: string) {
    const r = await query(`
      SELECT
        (SELECT COUNT(*) FROM wa_broadcast_optimizer_configs WHERE tenant_id = $1) AS configs,
        (SELECT COUNT(*) FROM wa_broadcast_batches WHERE tenant_id = $1) AS total_batches,
        (SELECT COUNT(*) FROM wa_broadcast_batches WHERE tenant_id = $1 AND status = 'scheduled') AS scheduled,
        (SELECT COUNT(*) FROM wa_broadcast_batches WHERE tenant_id = $1 AND status = 'completed') AS completed,
        (SELECT COALESCE(SUM(sent_count), 0) FROM wa_broadcast_batches WHERE tenant_id = $1) AS total_sent,
        (SELECT COALESCE(SUM(failed_count), 0) FROM wa_broadcast_batches WHERE tenant_id = $1) AS total_failed
    `, [tenantId]);
    return r.rows[0];
  }
}

// ══════════════════════════════════════════════════════════════════════════
//  MODULE 10: DIGITAL BUSINESS CARD BOT
// ══════════════════════════════════════════════════════════════════════════
export class BusinessCardService {
  static async list(tenantId: string) {
    const r = await query(`SELECT * FROM wa_business_cards WHERE tenant_id = $1 ORDER BY created_at DESC`, [tenantId]);
    return r.rows;
  }

  static async get(tenantId: string, id: string) {
    const r = await query(`SELECT * FROM wa_business_cards WHERE id = $1 AND tenant_id = $2`, [id, tenantId]);
    return r.rows[0] || null;
  }

  static async create(tenantId: string, data: Record<string, unknown>) {
    const r = await query(
      `INSERT INTO wa_business_cards (tenant_id, name, business_name, tagline, description, phone, email, website_url, address, location_lat, location_lng, services, social_links, logo_url, cover_url, interactive_buttons, lead_capture_enabled, lead_capture_fields, trigger_keyword)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19) RETURNING *`,
      [tenantId, data.name, data.business_name, data.tagline, data.description, data.phone, data.email, data.website_url, data.address, data.location_lat, data.location_lng, JSON.stringify(data.services), JSON.stringify(data.social_links), data.logo_url, data.cover_url, JSON.stringify(data.interactive_buttons), data.lead_capture_enabled, data.lead_capture_fields, data.trigger_keyword]
    );
    return r.rows[0];
  }

  static async update(tenantId: string, id: string, data: Record<string, unknown>) {
    const sets: string[] = []; const vals: unknown[] = []; let idx = 1;
    for (const [k, v] of Object.entries(data)) {
      if (v === undefined) continue;
      sets.push(`${k} = $${idx++}`);
      vals.push(['services', 'social_links', 'interactive_buttons'].includes(k) ? JSON.stringify(v) : v);
    }
    if (!sets.length) return null;
    sets.push(`updated_at = NOW()`);
    vals.push(id, tenantId);
    const r = await query(`UPDATE wa_business_cards SET ${sets.join(', ')} WHERE id = $${idx++} AND tenant_id = $${idx} RETURNING *`, vals);
    return r.rows[0] || null;
  }

  static async delete(tenantId: string, id: string) {
    await query(`DELETE FROM wa_business_cards WHERE id = $1 AND tenant_id = $2`, [id, tenantId]);
  }

  static async toggle(tenantId: string, id: string) {
    const r = await query(`UPDATE wa_business_cards SET is_active = NOT is_active, updated_at = NOW() WHERE id = $1 AND tenant_id = $2 RETURNING *`, [id, tenantId]);
    return r.rows[0] || null;
  }

  static async captureLead(tenantId: string, data: Record<string, unknown>) {
    const r = await query(
      `INSERT INTO wa_business_card_leads (tenant_id, card_id, contact_phone, contact_name, data, source) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [tenantId, data.card_id, data.contact_phone, data.contact_name, JSON.stringify(data.data), data.source]
    );
    await query(`UPDATE wa_business_cards SET lead_count = lead_count + 1 WHERE id = $1`, [data.card_id]);
    publishEvent('wa_saas:card_lead', { tenantId, card_id: data.card_id, phone: data.contact_phone });
    return r.rows[0];
  }

  static async listLeads(tenantId: string, cardId?: string) {
    const clauses = ['tenant_id = $1']; const vals: unknown[] = [tenantId]; let idx = 2;
    if (cardId) { clauses.push(`card_id = $${idx++}`); vals.push(cardId); }
    const r = await query(`SELECT * FROM wa_business_card_leads WHERE ${clauses.join(' AND ')} ORDER BY created_at DESC`, vals);
    return r.rows;
  }

  static async getByKeyword(keyword: string) {
    const r = await query(`SELECT * FROM wa_business_cards WHERE trigger_keyword = $1 AND is_active = true LIMIT 1`, [keyword]);
    return r.rows[0] || null;
  }

  static async getStats(tenantId: string) {
    const r = await query(`
      SELECT
        (SELECT COUNT(*) FROM wa_business_cards WHERE tenant_id = $1) AS total_cards,
        (SELECT COUNT(*) FROM wa_business_cards WHERE tenant_id = $1 AND is_active = true) AS active_cards,
        (SELECT COALESCE(SUM(view_count), 0) FROM wa_business_cards WHERE tenant_id = $1) AS total_views,
        (SELECT COALESCE(SUM(lead_count), 0) FROM wa_business_cards WHERE tenant_id = $1) AS total_leads
    `, [tenantId]);
    return r.rows[0];
  }
}

// ══════════════════════════════════════════════════════════════════════════
//  SHARED: NOTIFICATIONS & DASHBOARD
// ══════════════════════════════════════════════════════════════════════════
export class WaSaasNotificationService {
  static async create(tenantId: string, module: string, type: string, title: string, message?: string, severity = 'info', link?: string) {
    const r = await query(
      `INSERT INTO wa_saas_notifications (tenant_id, module, type, title, message, severity, link) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [tenantId, module, type, title, message, severity, link]
    );
    publishEvent('wa_saas:notification', { tenantId, module, type, title, severity });
    return r.rows[0];
  }

  static async list(tenantId: string, module?: string, isRead?: boolean) {
    const clauses = ['tenant_id = $1']; const vals: unknown[] = [tenantId]; let idx = 2;
    if (module) { clauses.push(`module = $${idx++}`); vals.push(module); }
    if (isRead !== undefined) { clauses.push(`is_read = $${idx++}`); vals.push(isRead); }
    const r = await query(`SELECT * FROM wa_saas_notifications WHERE ${clauses.join(' AND ')} ORDER BY created_at DESC LIMIT 100`, vals);
    return r.rows;
  }

  static async markRead(tenantId: string, id: string) {
    await query(`UPDATE wa_saas_notifications SET is_read = true WHERE id = $1 AND tenant_id = $2`, [id, tenantId]);
  }

  static async markAllRead(tenantId: string) {
    await query(`UPDATE wa_saas_notifications SET is_read = true WHERE tenant_id = $1 AND is_read = false`, [tenantId]);
  }
}

export class WaSaasDashboardService {
  static async getOverview(tenantId: string) {
    const [drip, ai, orders, subs, flash, team, links, reengage, broadcast, cards] = await Promise.all([
      DripService.getStats(tenantId),
      AiBotService.getStats(tenantId),
      OrderTrackingService.getStats(tenantId),
      SubscriptionBotService.getStats(tenantId),
      FlashSaleService.getStats(tenantId),
      TeamInboxService.getStats(tenantId),
      LinkTrackingService.getStats(tenantId),
      ReengagementService.getStats(tenantId),
      BroadcastOptimizerService.getStats(tenantId),
      BusinessCardService.getStats(tenantId),
    ]);
    return { drip, ai, orders, subs, flash, team, links, reengage, broadcast, cards };
  }
}
