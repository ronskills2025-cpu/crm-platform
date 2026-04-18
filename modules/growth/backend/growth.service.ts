import { query } from '../../../packages/db/src/connection';
import { redis } from '../../../packages/db/src/redis';
import { createLogger } from '../../../packages/utils/src/logger';

const log = createLogger('growth');

function publishEvent(channel: string, data: Record<string, unknown>) {
  try { redis.publish(channel, JSON.stringify(data)); } catch { /* ignore */ }
}

// ══════════════════════════════════════════════════════════════════════════════
//  MODULE 1: OMNICHANNEL LEAD CAPTURE
// ══════════════════════════════════════════════════════════════════════════════

export class LeadCaptureService {
  static async createForm(tenantId: string, data: Record<string, unknown>) {
    const r = await query(
      `INSERT INTO lead_capture_forms (tenant_id, name, source, form_fields, auto_response_enabled, auto_response_channel, auto_response_template, auto_tags, assigned_operator, webhook_url)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [tenantId, data.name, data.source, JSON.stringify(data.form_fields), data.auto_response_enabled, data.auto_response_channel, data.auto_response_template, data.auto_tags, data.assigned_operator, data.webhook_url]
    );
    return r.rows[0];
  }

  static async listForms(tenantId: string) {
    const r = await query(`SELECT * FROM lead_capture_forms WHERE tenant_id = $1 ORDER BY created_at DESC`, [tenantId]);
    return r.rows;
  }

  static async getForm(tenantId: string, id: string) {
    const r = await query(`SELECT * FROM lead_capture_forms WHERE id = $1 AND tenant_id = $2`, [id, tenantId]);
    return r.rows[0] || null;
  }

  static async updateForm(tenantId: string, id: string, data: Record<string, unknown>) {
    const sets: string[] = []; const vals: unknown[] = [id, tenantId]; let idx = 3;
    for (const [k, v] of Object.entries(data)) {
      if (v === undefined) continue;
      const val = (k === 'form_fields') ? JSON.stringify(v) : v;
      sets.push(`${k} = $${idx++}`); vals.push(val);
    }
    if (!sets.length) return null;
    sets.push('updated_at = NOW()');
    const r = await query(`UPDATE lead_capture_forms SET ${sets.join(', ')} WHERE id = $1 AND tenant_id = $2 RETURNING *`, vals);
    return r.rows[0] || null;
  }

  static async deleteForm(tenantId: string, id: string) {
    await query(`DELETE FROM lead_capture_forms WHERE id = $1 AND tenant_id = $2`, [id, tenantId]);
  }

  static async submitCapture(tenantId: string, data: Record<string, unknown>) {
    const r = await query(
      `INSERT INTO lead_capture_submissions (tenant_id, form_id, source, channel, contact_value, name, data, ip_address, user_agent)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [tenantId, data.form_id, data.source, data.channel, data.contact_value, data.name, JSON.stringify(data.data ?? {}), data.ip_address, data.user_agent]
    );
    if (data.form_id) {
      await query(`UPDATE lead_capture_forms SET submission_count = submission_count + 1 WHERE id = $1`, [data.form_id]);
    }
    publishEvent('growth:lead_captured', { tenantId, source: data.source, contact: data.contact_value });
    return r.rows[0];
  }

  static async listSubmissions(tenantId: string, opts: Record<string, unknown>) {
    const clauses = ['tenant_id = $1']; const vals: unknown[] = [tenantId]; let idx = 2;
    if (opts.form_id) { clauses.push(`form_id = $${idx++}`); vals.push(opts.form_id); }
    if (opts.source) { clauses.push(`source = $${idx++}`); vals.push(opts.source); }
    const limit = Number(opts.limit) || 100; const offset = Number(opts.offset) || 0;
    vals.push(limit, offset);
    const r = await query(`SELECT * FROM lead_capture_submissions WHERE ${clauses.join(' AND ')} ORDER BY created_at DESC LIMIT $${idx++} OFFSET $${idx}`, vals);
    return r.rows;
  }

  static async getStats(tenantId: string) {
    const r = await query(`
      SELECT
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours') AS today,
        COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days') AS week,
        COUNT(DISTINCT source) AS sources
      FROM lead_capture_submissions WHERE tenant_id = $1
    `, [tenantId]);
    return r.rows[0];
  }
}

// ══════════════════════════════════════════════════════════════════════════════
//  MODULE 2: MISSED CALL AUTOMATION
// ══════════════════════════════════════════════════════════════════════════════

export class MissedCallService {
  static async createConfig(tenantId: string, data: Record<string, unknown>) {
    const r = await query(
      `INSERT INTO missed_call_configs (tenant_id, name, phone_number, reply_channel, reply_template, followup_template, followup_delay_sec, capture_intent, intent_keywords)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [tenantId, data.name, data.phone_number, data.reply_channel, data.reply_template, data.followup_template, data.followup_delay_sec, data.capture_intent, JSON.stringify(data.intent_keywords ?? {})]
    );
    return r.rows[0];
  }

  static async listConfigs(tenantId: string) {
    const r = await query(`SELECT * FROM missed_call_configs WHERE tenant_id = $1 ORDER BY created_at DESC`, [tenantId]);
    return r.rows;
  }

  static async getConfig(tenantId: string, id: string) {
    const r = await query(`SELECT * FROM missed_call_configs WHERE id = $1 AND tenant_id = $2`, [id, tenantId]);
    return r.rows[0] || null;
  }

  static async updateConfig(tenantId: string, id: string, data: Record<string, unknown>) {
    const sets: string[] = []; const vals: unknown[] = [id, tenantId]; let idx = 3;
    for (const [k, v] of Object.entries(data)) {
      if (v === undefined) continue;
      const val = k === 'intent_keywords' ? JSON.stringify(v) : v;
      sets.push(`${k} = $${idx++}`); vals.push(val);
    }
    if (!sets.length) return null;
    sets.push('updated_at = NOW()');
    const r = await query(`UPDATE missed_call_configs SET ${sets.join(', ')} WHERE id = $1 AND tenant_id = $2 RETURNING *`, vals);
    return r.rows[0] || null;
  }

  static async deleteConfig(tenantId: string, id: string) {
    await query(`DELETE FROM missed_call_configs WHERE id = $1 AND tenant_id = $2`, [id, tenantId]);
  }

  static async logMissedCall(tenantId: string, data: Record<string, unknown>) {
    const r = await query(
      `INSERT INTO missed_calls (tenant_id, config_id, caller_number, called_number, call_time)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [tenantId, data.config_id, data.caller_number, data.called_number, data.call_time || new Date().toISOString()]
    );
    publishEvent('growth:missed_call', { tenantId, caller: data.caller_number });
    return r.rows[0];
  }

  static async listMissedCalls(tenantId: string, opts: Record<string, unknown>) {
    const clauses = ['tenant_id = $1']; const vals: unknown[] = [tenantId]; let idx = 2;
    if (opts.status) { clauses.push(`status = $${idx++}`); vals.push(opts.status); }
    if (opts.config_id) { clauses.push(`config_id = $${idx++}`); vals.push(opts.config_id); }
    const limit = Number(opts.limit) || 100; const offset = Number(opts.offset) || 0;
    vals.push(limit, offset);
    const r = await query(`SELECT * FROM missed_calls WHERE ${clauses.join(' AND ')} ORDER BY call_time DESC LIMIT $${idx++} OFFSET $${idx}`, vals);
    return r.rows;
  }

  static async updateMissedCall(id: string, data: Record<string, unknown>) {
    const sets: string[] = []; const vals: unknown[] = [id]; let idx = 2;
    for (const [k, v] of Object.entries(data)) {
      if (v === undefined) continue;
      sets.push(`${k} = $${idx++}`); vals.push(v);
    }
    if (!sets.length) return null;
    const r = await query(`UPDATE missed_calls SET ${sets.join(', ')} WHERE id = $1 RETURNING *`, vals);
    return r.rows[0] || null;
  }

  static async getStats(tenantId: string) {
    const r = await query(`
      SELECT COUNT(*) AS total,
        COUNT(*) FILTER (WHERE reply_sent = true) AS replied,
        COUNT(*) FILTER (WHERE lead_id IS NOT NULL) AS converted,
        COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours') AS today
      FROM missed_calls WHERE tenant_id = $1
    `, [tenantId]);
    return r.rows[0];
  }
}

// ══════════════════════════════════════════════════════════════════════════════
//  MODULE 3: SMART FOLLOW-UP SYSTEM
// ══════════════════════════════════════════════════════════════════════════════

export class FollowupService {
  static async createSequence(tenantId: string, data: Record<string, unknown>) {
    const r = await query(
      `INSERT INTO followup_sequences (tenant_id, name, trigger_type, trigger_conditions, steps, notify_team, notification_channels)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [tenantId, data.name, data.trigger_type, JSON.stringify(data.trigger_conditions ?? {}), JSON.stringify(data.steps), data.notify_team, data.notification_channels]
    );
    return r.rows[0];
  }

  static async listSequences(tenantId: string) {
    const r = await query(`SELECT * FROM followup_sequences WHERE tenant_id = $1 ORDER BY created_at DESC`, [tenantId]);
    return r.rows;
  }

  static async getSequence(tenantId: string, id: string) {
    const r = await query(`SELECT * FROM followup_sequences WHERE id = $1 AND tenant_id = $2`, [id, tenantId]);
    return r.rows[0] || null;
  }

  static async updateSequence(tenantId: string, id: string, data: Record<string, unknown>) {
    const sets: string[] = []; const vals: unknown[] = [id, tenantId]; let idx = 3;
    for (const [k, v] of Object.entries(data)) {
      if (v === undefined) continue;
      const val = (k === 'steps' || k === 'trigger_conditions') ? JSON.stringify(v) : v;
      sets.push(`${k} = $${idx++}`); vals.push(val);
    }
    if (!sets.length) return null;
    sets.push('updated_at = NOW()');
    const r = await query(`UPDATE followup_sequences SET ${sets.join(', ')} WHERE id = $1 AND tenant_id = $2 RETURNING *`, vals);
    return r.rows[0] || null;
  }

  static async deleteSequence(tenantId: string, id: string) {
    await query(`DELETE FROM followup_sequences WHERE id = $1 AND tenant_id = $2`, [id, tenantId]);
  }

  static async toggleSequence(tenantId: string, id: string) {
    const r = await query(`UPDATE followup_sequences SET is_active = NOT is_active, updated_at = NOW() WHERE id = $1 AND tenant_id = $2 RETURNING *`, [id, tenantId]);
    return r.rows[0] || null;
  }

  static async enrollLead(tenantId: string, data: Record<string, unknown>) {
    const r = await query(
      `INSERT INTO followup_enrollments (tenant_id, sequence_id, lead_id, contact_value, channel, next_action_at)
       VALUES ($1,$2,$3,$4,$5, NOW()) RETURNING *`,
      [tenantId, data.sequence_id, data.lead_id, data.contact_value, data.channel]
    );
    await query(`UPDATE followup_sequences SET enrolled_count = enrolled_count + 1 WHERE id = $1`, [data.sequence_id]);
    return r.rows[0];
  }

  static async listEnrollments(tenantId: string, opts: Record<string, unknown>) {
    const clauses = ['tenant_id = $1']; const vals: unknown[] = [tenantId]; let idx = 2;
    if (opts.sequence_id) { clauses.push(`sequence_id = $${idx++}`); vals.push(opts.sequence_id); }
    if (opts.status) { clauses.push(`status = $${idx++}`); vals.push(opts.status); }
    const limit = Number(opts.limit) || 100; const offset = Number(opts.offset) || 0;
    vals.push(limit, offset);
    const r = await query(`SELECT * FROM followup_enrollments WHERE ${clauses.join(' AND ')} ORDER BY created_at DESC LIMIT $${idx++} OFFSET $${idx}`, vals);
    return r.rows;
  }

  static async getPendingActions() {
    const r = await query(
      `SELECT e.*, s.steps, s.notify_team, s.notification_channels
       FROM followup_enrollments e
       JOIN followup_sequences s ON s.id = e.sequence_id
       WHERE e.status = 'active' AND e.next_action_at <= NOW() AND s.is_active = true
       LIMIT 100`
    );
    return r.rows;
  }

  static async advanceEnrollment(id: string, nextStep: number, nextActionAt: string | null) {
    if (nextActionAt) {
      await query(`UPDATE followup_enrollments SET current_step = $2, last_action_at = NOW(), next_action_at = $3 WHERE id = $1`, [id, nextStep, nextActionAt]);
    } else {
      await query(`UPDATE followup_enrollments SET current_step = $2, last_action_at = NOW(), status = 'completed', completed_at = NOW() WHERE id = $1`, [id, nextStep]);
    }
  }

  static async getStats(tenantId: string) {
    const r = await query(`
      SELECT
        (SELECT COUNT(*) FROM followup_sequences WHERE tenant_id = $1) AS sequences,
        (SELECT COUNT(*) FROM followup_enrollments WHERE tenant_id = $1 AND status = 'active') AS active,
        (SELECT COUNT(*) FROM followup_enrollments WHERE tenant_id = $1 AND status = 'completed') AS completed,
        (SELECT COUNT(*) FROM followup_enrollments WHERE tenant_id = $1 AND created_at > NOW() - INTERVAL '24 hours') AS enrolled_today
    `, [tenantId]);
    return r.rows[0];
  }
}

// ══════════════════════════════════════════════════════════════════════════════
//  MODULE 4: LOYALTY SYSTEM
// ══════════════════════════════════════════════════════════════════════════════

export class LoyaltyService {
  static async createProgram(tenantId: string, data: Record<string, unknown>) {
    const r = await query(
      `INSERT INTO loyalty_programs (tenant_id, name, points_per_purchase, points_per_referral, points_per_review, currency_value)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [tenantId, data.name, data.points_per_purchase, data.points_per_referral, data.points_per_review, data.currency_value]
    );
    return r.rows[0];
  }

  static async listPrograms(tenantId: string) {
    const r = await query(`SELECT * FROM loyalty_programs WHERE tenant_id = $1 ORDER BY created_at DESC`, [tenantId]);
    return r.rows;
  }

  static async getProgram(tenantId: string, id: string) {
    const r = await query(`SELECT * FROM loyalty_programs WHERE id = $1 AND tenant_id = $2`, [id, tenantId]);
    return r.rows[0] || null;
  }

  static async updateProgram(tenantId: string, id: string, data: Record<string, unknown>) {
    const sets: string[] = []; const vals: unknown[] = [id, tenantId]; let idx = 3;
    for (const [k, v] of Object.entries(data)) { if (v !== undefined) { sets.push(`${k} = $${idx++}`); vals.push(v); } }
    if (!sets.length) return null;
    sets.push('updated_at = NOW()');
    const r = await query(`UPDATE loyalty_programs SET ${sets.join(', ')} WHERE id = $1 AND tenant_id = $2 RETURNING *`, vals);
    return r.rows[0] || null;
  }

  static async addMember(tenantId: string, data: Record<string, unknown>) {
    const r = await query(
      `INSERT INTO loyalty_members (tenant_id, program_id, lead_id, name, contact_value, channel)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [tenantId, data.program_id, data.lead_id, data.name, data.contact_value, data.channel]
    );
    return r.rows[0];
  }

  static async listMembers(tenantId: string, opts: Record<string, unknown>) {
    const clauses = ['tenant_id = $1']; const vals: unknown[] = [tenantId]; let idx = 2;
    if (opts.program_id) { clauses.push(`program_id = $${idx++}`); vals.push(opts.program_id); }
    const where = clauses.join(' AND ');
    const countVals = [...vals];
    const limit = Number(opts.limit) || 100; const offset = Number(opts.offset) || 0;
    vals.push(limit, offset);
    const [r, cnt] = await Promise.all([
      query(`SELECT * FROM loyalty_members WHERE ${where} ORDER BY points_balance DESC LIMIT $${idx++} OFFSET $${idx}`, vals),
      query(`SELECT COUNT(*) AS count FROM loyalty_members WHERE ${where}`, countVals),
    ]);
    return { members: r.rows, total: parseInt(cnt.rows[0]?.count ?? '0') };
  }

  static async getMember(tenantId: string, id: string) {
    const r = await query(`SELECT * FROM loyalty_members WHERE id = $1 AND tenant_id = $2`, [id, tenantId]);
    return r.rows[0] || null;
  }

  static async addTransaction(tenantId: string, data: Record<string, unknown>) {
    const points = Number(data.points);
    const r = await query(
      `INSERT INTO loyalty_transactions (tenant_id, member_id, type, points, description, reference_id) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [tenantId, data.member_id, data.type, points, data.description, data.reference_id]
    );
    if (data.type === 'earn' || data.type === 'adjust') {
      await query(`UPDATE loyalty_members SET points_balance = points_balance + $2, total_earned = total_earned + $2, last_activity_at = NOW() WHERE id = $1`, [data.member_id, Math.abs(points)]);
    } else if (data.type === 'redeem') {
      await query(`UPDATE loyalty_members SET points_balance = points_balance - $2, total_redeemed = total_redeemed + $2, last_activity_at = NOW() WHERE id = $1`, [data.member_id, Math.abs(points)]);
    }
    // Tier update
    const mem = await query(`SELECT points_balance FROM loyalty_members WHERE id = $1`, [data.member_id]);
    if (mem.rows[0]) {
      const bal = mem.rows[0].points_balance;
      const tier = bal >= 5000 ? 'platinum' : bal >= 2000 ? 'gold' : bal >= 500 ? 'silver' : 'bronze';
      await query(`UPDATE loyalty_members SET tier = $2 WHERE id = $1`, [data.member_id, tier]);
    }
    return r.rows[0];
  }

  static async getTransactions(tenantId: string, memberId: string, limit = 50) {
    const r = await query(`SELECT * FROM loyalty_transactions WHERE tenant_id = $1 AND member_id = $2 ORDER BY created_at DESC LIMIT $3`, [tenantId, memberId, limit]);
    return r.rows;
  }

  static async createReward(tenantId: string, data: Record<string, unknown>) {
    const r = await query(
      `INSERT INTO loyalty_rewards (tenant_id, program_id, name, description, points_cost, reward_type, reward_value, stock) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [tenantId, data.program_id, data.name, data.description, data.points_cost, data.reward_type, JSON.stringify(data.reward_value ?? {}), data.stock]
    );
    return r.rows[0];
  }

  static async listRewards(tenantId: string, programId?: string) {
    const r = programId
      ? await query(`SELECT * FROM loyalty_rewards WHERE tenant_id = $1 AND program_id = $2 ORDER BY points_cost`, [tenantId, programId])
      : await query(`SELECT * FROM loyalty_rewards WHERE tenant_id = $1 ORDER BY points_cost`, [tenantId]);
    return r.rows;
  }

  static async redeemReward(tenantId: string, memberId: string, rewardId: string) {
    const reward = await query(`SELECT * FROM loyalty_rewards WHERE id = $1 AND tenant_id = $2 AND is_active = true`, [rewardId, tenantId]);
    if (!reward.rows[0]) throw new Error('Reward not found or inactive');
    const member = await query(`SELECT * FROM loyalty_members WHERE id = $1 AND tenant_id = $2`, [memberId, tenantId]);
    if (!member.rows[0]) throw new Error('Member not found');
    if (member.rows[0].points_balance < reward.rows[0].points_cost) throw new Error('Insufficient points');
    if (reward.rows[0].stock === 0) throw new Error('Out of stock');

    await LoyaltyService.addTransaction(tenantId, { member_id: memberId, type: 'redeem', points: reward.rows[0].points_cost, description: `Redeemed: ${reward.rows[0].name}`, reference_id: rewardId });
    if (reward.rows[0].stock > 0) {
      await query(`UPDATE loyalty_rewards SET redemption_count = redemption_count + 1, stock = stock - 1 WHERE id = $1`, [rewardId]);
    } else {
      await query(`UPDATE loyalty_rewards SET redemption_count = redemption_count + 1 WHERE id = $1`, [rewardId]);
    }
    return { success: true, reward: reward.rows[0].name };
  }

  static async getStats(tenantId: string) {
    const r = await query(`
      SELECT
        (SELECT COUNT(*) FROM loyalty_members WHERE tenant_id = $1) AS members,
        (SELECT COALESCE(SUM(points_balance), 0) FROM loyalty_members WHERE tenant_id = $1) AS total_points,
        (SELECT COUNT(*) FROM loyalty_transactions WHERE tenant_id = $1 AND type = 'redeem') AS redemptions,
        (SELECT COUNT(*) FROM loyalty_members WHERE tenant_id = $1 AND last_activity_at > NOW() - INTERVAL '30 days') AS active_members
    `, [tenantId]);
    return r.rows[0];
  }
}

// ══════════════════════════════════════════════════════════════════════════════
//  MODULE 5: REFERRAL SYSTEM
// ══════════════════════════════════════════════════════════════════════════════

export class ReferralService {
  static async createProgram(tenantId: string, data: Record<string, unknown>) {
    const r = await query(
      `INSERT INTO referral_programs (tenant_id, name, referrer_reward_points, referee_reward_points, referrer_reward_type, referee_reward_type, referrer_reward_value, referee_reward_value, max_referrals_per_user)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [tenantId, data.name, data.referrer_reward_points, data.referee_reward_points, data.referrer_reward_type, data.referee_reward_type, JSON.stringify(data.referrer_reward_value ?? {}), JSON.stringify(data.referee_reward_value ?? {}), data.max_referrals_per_user]
    );
    return r.rows[0];
  }

  static async listPrograms(tenantId: string) {
    const r = await query(`SELECT * FROM referral_programs WHERE tenant_id = $1 ORDER BY created_at DESC`, [tenantId]);
    return r.rows;
  }

  static async getProgram(tenantId: string, id: string) {
    const r = await query(`SELECT * FROM referral_programs WHERE id = $1 AND tenant_id = $2`, [id, tenantId]);
    return r.rows[0] || null;
  }

  static async updateProgram(tenantId: string, id: string, data: Record<string, unknown>) {
    const sets: string[] = []; const vals: unknown[] = [id, tenantId]; let idx = 3;
    for (const [k, v] of Object.entries(data)) {
      if (v === undefined) continue;
      const val = k.endsWith('_value') ? JSON.stringify(v) : v;
      sets.push(`${k} = $${idx++}`); vals.push(val);
    }
    if (!sets.length) return null;
    sets.push('updated_at = NOW()');
    const r = await query(`UPDATE referral_programs SET ${sets.join(', ')} WHERE id = $1 AND tenant_id = $2 RETURNING *`, vals);
    return r.rows[0] || null;
  }

  static async createLink(tenantId: string, data: Record<string, unknown>) {
    const code = `REF-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
    const r = await query(
      `INSERT INTO referral_links (tenant_id, program_id, referrer_id, referrer_name, referrer_contact, code) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [tenantId, data.program_id, data.referrer_id, data.referrer_name, data.referrer_contact, code]
    );
    return r.rows[0];
  }

  static async listLinks(tenantId: string, programId?: string) {
    const r = programId
      ? await query(`SELECT * FROM referral_links WHERE tenant_id = $1 AND program_id = $2 ORDER BY conversions DESC`, [tenantId, programId])
      : await query(`SELECT * FROM referral_links WHERE tenant_id = $1 ORDER BY conversions DESC`, [tenantId]);
    return r.rows;
  }

  static async trackClick(code: string) {
    await query(`UPDATE referral_links SET clicks = clicks + 1 WHERE code = $1`, [code]);
  }

  static async getLinkByCode(code: string) {
    const r = await query(`SELECT * FROM referral_links WHERE code = $1 AND is_active = true`, [code]);
    return r.rows[0] || null;
  }

  static async recordReferral(tenantId: string, data: Record<string, unknown>) {
    const r = await query(
      `INSERT INTO referrals (tenant_id, program_id, link_id, referrer_id, referee_contact, referee_name) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [tenantId, data.program_id, data.link_id, data.referrer_id, data.referee_contact, data.referee_name]
    );
    if (data.link_id) {
      await query(`UPDATE referral_links SET conversions = conversions + 1 WHERE id = $1`, [data.link_id]);
    }
    publishEvent('growth:referral_created', { tenantId, referrer: data.referrer_id, referee: data.referee_contact });
    return r.rows[0];
  }

  static async convertReferral(tenantId: string, id: string) {
    const r = await query(`UPDATE referrals SET status = 'converted', converted_at = NOW() WHERE id = $1 AND tenant_id = $2 RETURNING *`, [id, tenantId]);
    return r.rows[0] || null;
  }

  static async listReferrals(tenantId: string, opts: Record<string, unknown>) {
    const clauses = ['tenant_id = $1']; const vals: unknown[] = [tenantId]; let idx = 2;
    if (opts.program_id) { clauses.push(`program_id = $${idx++}`); vals.push(opts.program_id); }
    if (opts.status) { clauses.push(`status = $${idx++}`); vals.push(opts.status); }
    const limit = Number(opts.limit) || 100; const offset = Number(opts.offset) || 0;
    vals.push(limit, offset);
    const r = await query(`SELECT * FROM referrals WHERE ${clauses.join(' AND ')} ORDER BY created_at DESC LIMIT $${idx++} OFFSET $${idx}`, vals);
    return r.rows;
  }

  static async getLeaderboard(tenantId: string, programId: string, limit = 20) {
    const r = await query(
      `SELECT rl.referrer_id, rl.referrer_name, rl.referrer_contact, SUM(rl.conversions) AS total_conversions, SUM(rl.clicks) AS total_clicks
       FROM referral_links rl WHERE rl.tenant_id = $1 AND rl.program_id = $2
       GROUP BY rl.referrer_id, rl.referrer_name, rl.referrer_contact ORDER BY total_conversions DESC LIMIT $3`,
      [tenantId, programId, limit]
    );
    return r.rows;
  }

  static async getStats(tenantId: string) {
    const r = await query(`
      SELECT
        (SELECT COUNT(*) FROM referral_links WHERE tenant_id = $1) AS links,
        (SELECT COALESCE(SUM(clicks), 0) FROM referral_links WHERE tenant_id = $1) AS clicks,
        (SELECT COUNT(*) FROM referrals WHERE tenant_id = $1) AS referrals,
        (SELECT COUNT(*) FROM referrals WHERE tenant_id = $1 AND status = 'converted') AS conversions
    `, [tenantId]);
    return r.rows[0];
  }
}

// ══════════════════════════════════════════════════════════════════════════════
//  MODULE 6: REVIEW BOOSTER
// ══════════════════════════════════════════════════════════════════════════════

export class ReviewBoosterService {
  static async createCampaign(tenantId: string, data: Record<string, unknown>) {
    const r = await query(
      `INSERT INTO review_campaigns (tenant_id, name, google_review_url, delay_after_service_min, request_channel, request_template, positive_redirect_url, negative_followup_template, min_positive_rating)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [tenantId, data.name, data.google_review_url, data.delay_after_service_min, data.request_channel, data.request_template, data.positive_redirect_url, data.negative_followup_template, data.min_positive_rating]
    );
    return r.rows[0];
  }

  static async listCampaigns(tenantId: string) {
    const r = await query(`SELECT * FROM review_campaigns WHERE tenant_id = $1 ORDER BY created_at DESC`, [tenantId]);
    return r.rows;
  }

  static async getCampaign(tenantId: string, id: string) {
    const r = await query(`SELECT * FROM review_campaigns WHERE id = $1 AND tenant_id = $2`, [id, tenantId]);
    return r.rows[0] || null;
  }

  static async updateCampaign(tenantId: string, id: string, data: Record<string, unknown>) {
    const sets: string[] = []; const vals: unknown[] = [id, tenantId]; let idx = 3;
    for (const [k, v] of Object.entries(data)) { if (v !== undefined) { sets.push(`${k} = $${idx++}`); vals.push(v); } }
    if (!sets.length) return null;
    sets.push('updated_at = NOW()');
    const r = await query(`UPDATE review_campaigns SET ${sets.join(', ')} WHERE id = $1 AND tenant_id = $2 RETURNING *`, vals);
    return r.rows[0] || null;
  }

  static async deleteCampaign(tenantId: string, id: string) {
    await query(`DELETE FROM review_campaigns WHERE id = $1 AND tenant_id = $2`, [id, tenantId]);
  }

  static async createRequest(tenantId: string, data: Record<string, unknown>) {
    const r = await query(
      `INSERT INTO review_requests (tenant_id, campaign_id, contact_value, customer_name, channel) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [tenantId, data.campaign_id, data.contact_value, data.customer_name, data.channel]
    );
    await query(`UPDATE review_campaigns SET sent_count = sent_count + 1 WHERE id = $1`, [data.campaign_id]);
    return r.rows[0];
  }

  static async submitResponse(id: string, rating: number, feedback?: string) {
    const campaign = await query(
      `SELECT rc.* FROM review_campaigns rc JOIN review_requests rr ON rr.campaign_id = rc.id WHERE rr.id = $1`, [id]
    );
    const camp = campaign.rows[0];
    const isPositive = camp ? rating >= (camp.min_positive_rating || 4) : rating >= 4;

    await query(
      `UPDATE review_requests SET status = 'responded', rating = $2, feedback = $3, redirected_to_google = $4, handled_privately = $5 WHERE id = $1`,
      [id, rating, feedback, isPositive, !isPositive]
    );

    if (camp) {
      await query(`UPDATE review_campaigns SET response_count = response_count + 1, ${isPositive ? 'positive_count' : 'negative_count'} = ${isPositive ? 'positive_count' : 'negative_count'} + 1 WHERE id = $1`, [camp.id]);
    }

    if (isPositive && camp?.google_review_url) {
      return { redirect_url: camp.google_review_url };
    }
    if (!isPositive) {
      publishEvent('growth:negative_review', { requestId: id, rating, feedback });
    }
    return { handled_privately: !isPositive };
  }

  static async listRequests(tenantId: string, campaignId: string, opts: Record<string, unknown>) {
    const clauses = ['tenant_id = $1', 'campaign_id = $2']; const vals: unknown[] = [tenantId, campaignId]; let idx = 3;
    if (opts.status) { clauses.push(`status = $${idx++}`); vals.push(opts.status); }
    const limit = Number(opts.limit) || 100; const offset = Number(opts.offset) || 0;
    vals.push(limit, offset);
    const r = await query(`SELECT * FROM review_requests WHERE ${clauses.join(' AND ')} ORDER BY created_at DESC LIMIT $${idx++} OFFSET $${idx}`, vals);
    return r.rows;
  }

  static async getStats(tenantId: string) {
    const r = await query(`
      SELECT
        (SELECT COUNT(*) FROM review_campaigns WHERE tenant_id = $1) AS campaigns,
        (SELECT COALESCE(SUM(sent_count), 0) FROM review_campaigns WHERE tenant_id = $1) AS sent,
        (SELECT COALESCE(SUM(response_count), 0) FROM review_campaigns WHERE tenant_id = $1) AS responses,
        (SELECT COALESCE(SUM(positive_count), 0) FROM review_campaigns WHERE tenant_id = $1) AS positive,
        (SELECT COALESCE(SUM(negative_count), 0) FROM review_campaigns WHERE tenant_id = $1) AS negative
    `, [tenantId]);
    return r.rows[0];
  }
}

// ══════════════════════════════════════════════════════════════════════════════
//  MODULE 7: SALES PIPELINE CRM
// ══════════════════════════════════════════════════════════════════════════════

export class PipelineService {
  static async createPipeline(tenantId: string, data: Record<string, unknown>) {
    const r = await query(
      `INSERT INTO pipelines (tenant_id, name, stages, is_default) VALUES ($1,$2,$3,$4) RETURNING *`,
      [tenantId, data.name, JSON.stringify(data.stages), data.is_default]
    );
    return r.rows[0];
  }

  static async listPipelines(tenantId: string) {
    const r = await query(`SELECT * FROM pipelines WHERE tenant_id = $1 ORDER BY created_at`, [tenantId]);
    return r.rows;
  }

  static async getPipeline(tenantId: string, id: string) {
    const r = await query(`SELECT * FROM pipelines WHERE id = $1 AND tenant_id = $2`, [id, tenantId]);
    return r.rows[0] || null;
  }

  static async updatePipeline(tenantId: string, id: string, data: Record<string, unknown>) {
    const sets: string[] = []; const vals: unknown[] = [id, tenantId]; let idx = 3;
    for (const [k, v] of Object.entries(data)) {
      if (v === undefined) continue;
      const val = k === 'stages' ? JSON.stringify(v) : v;
      sets.push(`${k} = $${idx++}`); vals.push(val);
    }
    if (!sets.length) return null;
    sets.push('updated_at = NOW()');
    const r = await query(`UPDATE pipelines SET ${sets.join(', ')} WHERE id = $1 AND tenant_id = $2 RETURNING *`, vals);
    return r.rows[0] || null;
  }

  static async deletePipeline(tenantId: string, id: string) {
    await query(`DELETE FROM pipelines WHERE id = $1 AND tenant_id = $2`, [id, tenantId]);
  }

  static async createDeal(tenantId: string, data: Record<string, unknown>) {
    const r = await query(
      `INSERT INTO pipeline_deals (tenant_id, pipeline_id, lead_id, title, contact_name, contact_value, stage, value, currency, probability, assigned_to, expected_close_date, tags)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
      [tenantId, data.pipeline_id, data.lead_id, data.title, data.contact_name, data.contact_value, data.stage, data.value, data.currency, data.probability, data.assigned_to, data.expected_close_date, data.tags]
    );
    await PipelineService.logActivity(tenantId, { deal_id: r.rows[0].id, type: 'system', description: 'Deal created' });
    publishEvent('growth:deal_created', { tenantId, dealId: r.rows[0].id, title: data.title });
    return r.rows[0];
  }

  static async listDeals(tenantId: string, opts: Record<string, unknown>) {
    const clauses = ['tenant_id = $1']; const vals: unknown[] = [tenantId]; let idx = 2;
    if (opts.pipeline_id) { clauses.push(`pipeline_id = $${idx++}`); vals.push(opts.pipeline_id); }
    if (opts.stage) { clauses.push(`stage = $${idx++}`); vals.push(opts.stage); }
    if (opts.assigned_to) { clauses.push(`assigned_to = $${idx++}`); vals.push(opts.assigned_to); }
    const where = clauses.join(' AND ');
    const countVals = [...vals];
    const limit = Number(opts.limit) || 200; const offset = Number(opts.offset) || 0;
    vals.push(limit, offset);
    const [r, cnt] = await Promise.all([
      query(`SELECT * FROM pipeline_deals WHERE ${where} ORDER BY position, created_at DESC LIMIT $${idx++} OFFSET $${idx}`, vals),
      query(`SELECT COUNT(*) AS count FROM pipeline_deals WHERE ${where}`, countVals),
    ]);
    return { deals: r.rows, total: parseInt(cnt.rows[0]?.count ?? '0') };
  }

  static async getDeal(tenantId: string, id: string) {
    const r = await query(`SELECT * FROM pipeline_deals WHERE id = $1 AND tenant_id = $2`, [id, tenantId]);
    return r.rows[0] || null;
  }

  static async updateDeal(tenantId: string, id: string, data: Record<string, unknown>) {
    const sets: string[] = []; const vals: unknown[] = [id, tenantId]; let idx = 3;
    for (const [k, v] of Object.entries(data)) { if (v !== undefined) { sets.push(`${k} = $${idx++}`); vals.push(v); } }
    if (!sets.length) return null;
    sets.push('updated_at = NOW()');
    const r = await query(`UPDATE pipeline_deals SET ${sets.join(', ')} WHERE id = $1 AND tenant_id = $2 RETURNING *`, vals);
    return r.rows[0] || null;
  }

  static async moveDeal(tenantId: string, id: string, stage: string, position?: number) {
    const oldDeal = await query(`SELECT stage FROM pipeline_deals WHERE id = $1 AND tenant_id = $2`, [id, tenantId]);
    const oldStage = oldDeal.rows[0]?.stage;
    const r = await query(
      `UPDATE pipeline_deals SET stage = $3, position = COALESCE($4, position), updated_at = NOW()${stage.startsWith('Closed') ? ", closed_at = NOW()" : ""} WHERE id = $1 AND tenant_id = $2 RETURNING *`,
      [id, tenantId, stage, position ?? null]
    );
    if (r.rows[0] && oldStage !== stage) {
      await PipelineService.logActivity(tenantId, { deal_id: id, type: 'stage_change', description: `Moved from "${oldStage}" to "${stage}"` });
      if (stage === 'Closed Won') publishEvent('growth:deal_won', { tenantId, dealId: id, value: r.rows[0].value });
    }
    return r.rows[0] || null;
  }

  static async deleteDeal(tenantId: string, id: string) {
    await query(`DELETE FROM pipeline_deals WHERE id = $1 AND tenant_id = $2`, [id, tenantId]);
  }

  static async logActivity(tenantId: string, data: Record<string, unknown>) {
    const r = await query(
      `INSERT INTO pipeline_activities (tenant_id, deal_id, type, description, performed_by, metadata) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [tenantId, data.deal_id, data.type, data.description, data.performed_by, JSON.stringify(data.metadata ?? {})]
    );
    return r.rows[0];
  }

  static async getActivities(tenantId: string, dealId: string, limit = 50) {
    const r = await query(`SELECT * FROM pipeline_activities WHERE tenant_id = $1 AND deal_id = $2 ORDER BY created_at DESC LIMIT $3`, [tenantId, dealId, limit]);
    return r.rows;
  }

  static async getStats(tenantId: string, pipelineId?: string) {
    const filter = pipelineId ? `AND pipeline_id = '${pipelineId}'` : '';
    const r = await query(`
      SELECT
        COUNT(*) AS total_deals,
        COUNT(*) FILTER (WHERE stage NOT LIKE 'Closed%') AS open_deals,
        COUNT(*) FILTER (WHERE stage = 'Closed Won') AS won_deals,
        COUNT(*) FILTER (WHERE stage = 'Closed Lost') AS lost_deals,
        COALESCE(SUM(value) FILTER (WHERE stage = 'Closed Won'), 0) AS won_value,
        COALESCE(SUM(value) FILTER (WHERE stage NOT LIKE 'Closed%'), 0) AS pipeline_value
      FROM pipeline_deals WHERE tenant_id = $1 ${filter}
    `, [tenantId]);
    return r.rows[0];
  }
}

// ══════════════════════════════════════════════════════════════════════════════
//  MODULE 8: SEGMENTED BROADCAST
// ══════════════════════════════════════════════════════════════════════════════

export class BroadcastService {
  static async createSegment(tenantId: string, data: Record<string, unknown>) {
    const r = await query(
      `INSERT INTO broadcast_segments (tenant_id, name, description, filter_rules, is_dynamic) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [tenantId, data.name, data.description, JSON.stringify(data.filter_rules), data.is_dynamic]
    );
    return r.rows[0];
  }

  static async listSegments(tenantId: string, opts?: Record<string, unknown>) {
    const limit = Number(opts?.limit) || 200; const offset = Number(opts?.offset) || 0;
    const [r, cnt] = await Promise.all([
      query(`SELECT * FROM broadcast_segments WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`, [tenantId, limit, offset]),
      query(`SELECT COUNT(*) AS count FROM broadcast_segments WHERE tenant_id = $1`, [tenantId]),
    ]);
    return { segments: r.rows, total: parseInt(cnt.rows[0]?.count ?? '0') };
  }

  static async getSegment(tenantId: string, id: string) {
    const r = await query(`SELECT * FROM broadcast_segments WHERE id = $1 AND tenant_id = $2`, [id, tenantId]);
    return r.rows[0] || null;
  }

  static async updateSegment(tenantId: string, id: string, data: Record<string, unknown>) {
    const sets: string[] = []; const vals: unknown[] = [id, tenantId]; let idx = 3;
    for (const [k, v] of Object.entries(data)) {
      if (v === undefined) continue;
      const val = k === 'filter_rules' ? JSON.stringify(v) : v;
      sets.push(`${k} = $${idx++}`); vals.push(val);
    }
    if (!sets.length) return null;
    sets.push('updated_at = NOW()');
    const r = await query(`UPDATE broadcast_segments SET ${sets.join(', ')} WHERE id = $1 AND tenant_id = $2 RETURNING *`, vals);
    return r.rows[0] || null;
  }

  static async deleteSegment(tenantId: string, id: string) {
    await query(`DELETE FROM broadcast_segments WHERE id = $1 AND tenant_id = $2`, [id, tenantId]);
  }

  static async computeSegmentContacts(tenantId: string, segmentId: string) {
    const seg = await query(`SELECT filter_rules FROM broadcast_segments WHERE id = $1 AND tenant_id = $2`, [segmentId, tenantId]);
    if (!seg.rows[0]) return [];
    const rules = seg.rows[0].filter_rules as Record<string, unknown>;
    const clauses = ['tenant_id = $1']; const vals: unknown[] = [tenantId]; let idx = 2;
    if (rules.tags && Array.isArray(rules.tags)) { clauses.push(`tags && $${idx++}`); vals.push(rules.tags); }
    if (rules.segment) { clauses.push(`segment = $${idx++}`); vals.push(rules.segment); }
    if (rules.channel) { clauses.push(`channel = $${idx++}`); vals.push(rules.channel); }
    const r = await query(`SELECT id, contact_value, name, channel, segment, tags FROM leads WHERE ${clauses.join(' AND ')} LIMIT 10000`, vals);
    await query(`UPDATE broadcast_segments SET contact_count = $2, last_computed_at = NOW() WHERE id = $1`, [segmentId, r.rows.length]);
    return r.rows;
  }

  static async createCampaign(tenantId: string, data: Record<string, unknown>) {
    const r = await query(
      `INSERT INTO broadcast_campaigns (tenant_id, segment_id, name, channel, message_template, personalization_fields, scheduled_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [tenantId, data.segment_id, data.name, data.channel, data.message_template, JSON.stringify(data.personalization_fields ?? {}), data.scheduled_at]
    );
    return r.rows[0];
  }

  static async listCampaigns(tenantId: string, opts: Record<string, unknown>) {
    const clauses = ['tenant_id = $1']; const vals: unknown[] = [tenantId]; let idx = 2;
    if (opts.status) { clauses.push(`status = $${idx++}`); vals.push(opts.status); }
    const where = clauses.map(c => `bc.${c}`).join(' AND ');
    const countVals = [...vals];
    const limit = Number(opts.limit) || 100; const offset = Number(opts.offset) || 0;
    vals.push(limit, offset);
    const [r, cnt] = await Promise.all([
      query(`SELECT bc.*, bs.name AS segment_name FROM broadcast_campaigns bc LEFT JOIN broadcast_segments bs ON bs.id = bc.segment_id WHERE ${where} ORDER BY bc.created_at DESC LIMIT $${idx++} OFFSET $${idx}`, vals),
      query(`SELECT COUNT(*) AS count FROM broadcast_campaigns bc WHERE ${where}`, countVals),
    ]);
    return { campaigns: r.rows, total: parseInt(cnt.rows[0]?.count ?? '0') };
  }

  static async getCampaign(tenantId: string, id: string) {
    const r = await query(`SELECT bc.*, bs.name AS segment_name FROM broadcast_campaigns bc LEFT JOIN broadcast_segments bs ON bs.id = bc.segment_id WHERE bc.id = $1 AND bc.tenant_id = $2`, [id, tenantId]);
    return r.rows[0] || null;
  }

  static async updateCampaign(tenantId: string, id: string, data: Record<string, unknown>) {
    const sets: string[] = []; const vals: unknown[] = [id, tenantId]; let idx = 3;
    for (const [k, v] of Object.entries(data)) {
      if (v === undefined) continue;
      const val = k === 'personalization_fields' ? JSON.stringify(v) : v;
      sets.push(`${k} = $${idx++}`); vals.push(val);
    }
    if (!sets.length) return null;
    sets.push('updated_at = NOW()');
    const r = await query(`UPDATE broadcast_campaigns SET ${sets.join(', ')} WHERE id = $1 AND tenant_id = $2 RETURNING *`, vals);
    return r.rows[0] || null;
  }

  static async deleteCampaign(tenantId: string, id: string) {
    await query(`DELETE FROM broadcast_campaigns WHERE id = $1 AND tenant_id = $2`, [id, tenantId]);
  }

  static async getStats(tenantId: string) {
    const r = await query(`
      SELECT
        (SELECT COUNT(*) FROM broadcast_segments WHERE tenant_id = $1) AS segments,
        (SELECT COUNT(*) FROM broadcast_campaigns WHERE tenant_id = $1) AS campaigns,
        (SELECT COALESCE(SUM(sent_count), 0) FROM broadcast_campaigns WHERE tenant_id = $1) AS sent,
        (SELECT COALESCE(SUM(delivered_count), 0) FROM broadcast_campaigns WHERE tenant_id = $1) AS delivered
    `, [tenantId]);
    return r.rows[0];
  }
}

// ══════════════════════════════════════════════════════════════════════════════
//  MODULE 9: ADS PERFORMANCE TRACKER
// ══════════════════════════════════════════════════════════════════════════════

export class AdsService {
  static async createCampaign(tenantId: string, data: Record<string, unknown>) {
    const r = await query(
      `INSERT INTO ad_campaigns (tenant_id, platform, campaign_name, campaign_external_id, ad_set_name, ad_name, budget, start_date, end_date, metadata)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [tenantId, data.platform, data.campaign_name, data.campaign_external_id, data.ad_set_name, data.ad_name, data.budget, data.start_date, data.end_date, JSON.stringify(data.metadata ?? {})]
    );
    return r.rows[0];
  }

  static async listCampaigns(tenantId: string, opts: Record<string, unknown>) {
    const clauses = ['tenant_id = $1']; const vals: unknown[] = [tenantId]; let idx = 2;
    if (opts.platform) { clauses.push(`platform = $${idx++}`); vals.push(opts.platform); }
    if (opts.status) { clauses.push(`status = $${idx++}`); vals.push(opts.status); }
    const limit = Number(opts.limit) || 100; const offset = Number(opts.offset) || 0;
    vals.push(limit, offset);
    const r = await query(`SELECT * FROM ad_campaigns WHERE ${clauses.join(' AND ')} ORDER BY created_at DESC LIMIT $${idx++} OFFSET $${idx}`, vals);
    return r.rows;
  }

  static async getCampaign(tenantId: string, id: string) {
    const r = await query(`SELECT * FROM ad_campaigns WHERE id = $1 AND tenant_id = $2`, [id, tenantId]);
    return r.rows[0] || null;
  }

  static async updateCampaign(tenantId: string, id: string, data: Record<string, unknown>) {
    const sets: string[] = []; const vals: unknown[] = [id, tenantId]; let idx = 3;
    for (const [k, v] of Object.entries(data)) {
      if (v === undefined) continue;
      const val = k === 'metadata' ? JSON.stringify(v) : v;
      sets.push(`${k} = $${idx++}`); vals.push(val);
    }
    if (!sets.length) return null;
    // Recalculate CPL, CPA, ROAS
    sets.push('updated_at = NOW()');
    const r = await query(`UPDATE ad_campaigns SET ${sets.join(', ')} WHERE id = $1 AND tenant_id = $2 RETURNING *`, vals);
    if (r.rows[0]) {
      const c = r.rows[0];
      const cpl = c.leads_count > 0 ? c.spend / c.leads_count : 0;
      const cpa = c.conversions > 0 ? c.spend / c.conversions : 0;
      const roas = c.spend > 0 ? c.revenue / c.spend : 0;
      await query(`UPDATE ad_campaigns SET cpl = $2, cpa = $3, roas = $4 WHERE id = $1`, [id, cpl.toFixed(2), cpa.toFixed(2), roas.toFixed(2)]);
    }
    return r.rows[0] || null;
  }

  static async deleteCampaign(tenantId: string, id: string) {
    await query(`DELETE FROM ad_campaigns WHERE id = $1 AND tenant_id = $2`, [id, tenantId]);
  }

  static async trackConversion(tenantId: string, data: Record<string, unknown>) {
    const r = await query(
      `INSERT INTO ad_conversions (tenant_id, ad_campaign_id, lead_id, contact_value, conversion_type, value, utm_source, utm_medium, utm_campaign, utm_content, landing_page, metadata)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
      [tenantId, data.ad_campaign_id, data.lead_id, data.contact_value, data.conversion_type, data.value, data.utm_source, data.utm_medium, data.utm_campaign, data.utm_content, data.landing_page, JSON.stringify(data.metadata ?? {})]
    );
    // Update campaign counters
    const convType = data.conversion_type as string;
    if (convType === 'lead') {
      await query(`UPDATE ad_campaigns SET leads_count = leads_count + 1 WHERE id = $1`, [data.ad_campaign_id]);
    } else if (convType === 'sale') {
      await query(`UPDATE ad_campaigns SET conversions = conversions + 1, revenue = revenue + $2 WHERE id = $1`, [data.ad_campaign_id, data.value ?? 0]);
    } else {
      await query(`UPDATE ad_campaigns SET conversions = conversions + 1 WHERE id = $1`, [data.ad_campaign_id]);
    }
    publishEvent('growth:ad_conversion', { tenantId, type: convType, campaignId: data.ad_campaign_id });
    return r.rows[0];
  }

  static async listConversions(tenantId: string, campaignId: string, limit = 100) {
    const r = await query(`SELECT * FROM ad_conversions WHERE tenant_id = $1 AND ad_campaign_id = $2 ORDER BY created_at DESC LIMIT $3`, [tenantId, campaignId, limit]);
    return r.rows;
  }

  static async getROIDashboard(tenantId: string) {
    const r = await query(`
      SELECT
        COALESCE(SUM(spend), 0) AS total_spend,
        COALESCE(SUM(revenue), 0) AS total_revenue,
        COALESCE(SUM(leads_count), 0) AS total_leads,
        COALESCE(SUM(conversions), 0) AS total_conversions,
        COALESCE(SUM(clicks), 0) AS total_clicks,
        COALESCE(SUM(impressions), 0) AS total_impressions,
        CASE WHEN SUM(spend) > 0 THEN ROUND(SUM(revenue) / SUM(spend), 2) ELSE 0 END AS overall_roas,
        CASE WHEN SUM(leads_count) > 0 THEN ROUND(SUM(spend) / SUM(leads_count), 2) ELSE 0 END AS avg_cpl
      FROM ad_campaigns WHERE tenant_id = $1
    `, [tenantId]);
    return r.rows[0];
  }

  static async getByPlatform(tenantId: string) {
    const r = await query(`
      SELECT platform, COUNT(*) AS campaigns, COALESCE(SUM(spend), 0) AS spend, COALESCE(SUM(revenue), 0) AS revenue,
        COALESCE(SUM(leads_count), 0) AS leads, COALESCE(SUM(conversions), 0) AS conversions
      FROM ad_campaigns WHERE tenant_id = $1 GROUP BY platform ORDER BY spend DESC
    `, [tenantId]);
    return r.rows;
  }
}

// ══════════════════════════════════════════════════════════════════════════════
//  MODULE 10: MINI WEBSITE BUILDER
// ══════════════════════════════════════════════════════════════════════════════

export class WebsiteService {
  static async create(tenantId: string, data: Record<string, unknown>) {
    const r = await query(
      `INSERT INTO mini_websites (tenant_id, name, slug, template, hero_title, hero_subtitle, hero_image_url, cta_text, cta_action, cta_value, sections, form_fields, whatsapp_widget_enabled, whatsapp_number, theme_color, custom_css, seo_title, seo_description)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18) RETURNING *`,
      [tenantId, data.name, data.slug, data.template, data.hero_title, data.hero_subtitle, data.hero_image_url, data.cta_text, data.cta_action, data.cta_value, JSON.stringify(data.sections ?? []), JSON.stringify(data.form_fields ?? []), data.whatsapp_widget_enabled, data.whatsapp_number, data.theme_color, data.custom_css, data.seo_title, data.seo_description]
    );
    return r.rows[0];
  }

  static async list(tenantId: string) {
    const r = await query(`SELECT * FROM mini_websites WHERE tenant_id = $1 ORDER BY created_at DESC`, [tenantId]);
    return r.rows;
  }

  static async getById(tenantId: string, id: string) {
    const r = await query(`SELECT * FROM mini_websites WHERE id = $1 AND tenant_id = $2`, [id, tenantId]);
    return r.rows[0] || null;
  }

  static async getBySlug(slug: string) {
    const r = await query(`SELECT * FROM mini_websites WHERE slug = $1 AND is_published = true`, [slug]);
    if (r.rows[0]) {
      await query(`UPDATE mini_websites SET visit_count = visit_count + 1 WHERE id = $1`, [r.rows[0].id]);
    }
    return r.rows[0] || null;
  }

  static async update(tenantId: string, id: string, data: Record<string, unknown>) {
    const sets: string[] = []; const vals: unknown[] = [id, tenantId]; let idx = 3;
    for (const [k, v] of Object.entries(data)) {
      if (v === undefined) continue;
      const val = (k === 'sections' || k === 'form_fields') ? JSON.stringify(v) : v;
      sets.push(`${k} = $${idx++}`); vals.push(val);
    }
    if (!sets.length) return null;
    sets.push('updated_at = NOW()');
    const r = await query(`UPDATE mini_websites SET ${sets.join(', ')} WHERE id = $1 AND tenant_id = $2 RETURNING *`, vals);
    return r.rows[0] || null;
  }

  static async publish(tenantId: string, id: string) {
    const r = await query(`UPDATE mini_websites SET is_published = true, updated_at = NOW() WHERE id = $1 AND tenant_id = $2 RETURNING *`, [id, tenantId]);
    return r.rows[0] || null;
  }

  static async unpublish(tenantId: string, id: string) {
    const r = await query(`UPDATE mini_websites SET is_published = false, updated_at = NOW() WHERE id = $1 AND tenant_id = $2 RETURNING *`, [id, tenantId]);
    return r.rows[0] || null;
  }

  static async delete(tenantId: string, id: string) {
    await query(`DELETE FROM mini_websites WHERE id = $1 AND tenant_id = $2`, [id, tenantId]);
  }

  static async submitForm(slug: string, data: Record<string, unknown>) {
    const site = await WebsiteService.getBySlug(slug);
    if (!site) throw new Error('Website not found');
    await query(`UPDATE mini_websites SET lead_count = lead_count + 1 WHERE id = $1`, [site.id]);
    publishEvent('growth:website_lead', { tenantId: site.tenant_id, slug, contact: data.contact_value });
    return { success: true, tenantId: site.tenant_id };
  }
}

// ══════════════════════════════════════════════════════════════════════════════
//  GROWTH NOTIFICATIONS
// ══════════════════════════════════════════════════════════════════════════════

export class GrowthNotificationService {
  static async create(tenantId: string, type: string, title: string, message?: string, severity = 'info', link?: string) {
    const r = await query(
      `INSERT INTO growth_notifications (tenant_id, type, title, message, severity, link) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [tenantId, type, title, message, severity, link]
    );
    publishEvent('growth:notification', { tenantId, type, title, severity });
    return r.rows[0];
  }

  static async list(tenantId: string, opts: Record<string, unknown>) {
    const clauses = ['tenant_id = $1']; const vals: unknown[] = [tenantId]; let idx = 2;
    if (opts.type) { clauses.push(`type = $${idx++}`); vals.push(opts.type); }
    if (opts.is_read !== undefined) { clauses.push(`is_read = $${idx++}`); vals.push(opts.is_read); }
    const limit = Number(opts.limit) || 50; const offset = Number(opts.offset) || 0;
    vals.push(limit, offset);
    const r = await query(`SELECT * FROM growth_notifications WHERE ${clauses.join(' AND ')} ORDER BY created_at DESC LIMIT $${idx++} OFFSET $${idx}`, vals);
    return r.rows;
  }

  static async markRead(tenantId: string, id: string) {
    await query(`UPDATE growth_notifications SET is_read = true WHERE id = $1 AND tenant_id = $2`, [id, tenantId]);
  }

  static async markAllRead(tenantId: string) {
    await query(`UPDATE growth_notifications SET is_read = true WHERE tenant_id = $1 AND is_read = false`, [tenantId]);
  }

  static async getUnreadCount(tenantId: string) {
    const r = await query(`SELECT COUNT(*) AS count FROM growth_notifications WHERE tenant_id = $1 AND is_read = false`, [tenantId]);
    return Number(r.rows[0]?.count ?? 0);
  }
}

// ══════════════════════════════════════════════════════════════════════════════
//  GROWTH DASHBOARD AGGREGATION
// ══════════════════════════════════════════════════════════════════════════════

export class GrowthDashboardService {
  static async getOverview(tenantId: string) {
    const [leads, calls, followups, loyalty, referrals, reviews, pipeline, broadcast, ads] = await Promise.all([
      LeadCaptureService.getStats(tenantId),
      MissedCallService.getStats(tenantId),
      FollowupService.getStats(tenantId),
      LoyaltyService.getStats(tenantId),
      ReferralService.getStats(tenantId),
      ReviewBoosterService.getStats(tenantId),
      PipelineService.getStats(tenantId),
      BroadcastService.getStats(tenantId),
      AdsService.getROIDashboard(tenantId),
    ]);
    return { leads, calls, followups, loyalty, referrals, reviews, pipeline, broadcast, ads };
  }
}
