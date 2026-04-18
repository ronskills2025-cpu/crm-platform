import { query } from '../../../packages/db/src/connection';

export class SenderIdService {
  static async list(tenantId: string) {
    const result = await query(
      `SELECT * FROM sms_sender_ids WHERE tenant_id = $1 ORDER BY created_at DESC`,
      [tenantId]
    );
    return result.rows;
  }

  static async create(tenantId: string, data: { sender_id: string; type?: string; region?: string; description?: string }) {
    const result = await query(
      `INSERT INTO sms_sender_ids (tenant_id, sender_id, type, region, description)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [tenantId, data.sender_id, data.type || 'alphanumeric', data.region || null, data.description || null]
    );
    return result.rows[0];
  }

  static async update(tenantId: string, id: string, data: { approval_status?: string; is_active?: boolean; description?: string }) {
    const sets: string[] = [];
    const vals: unknown[] = [];
    let idx = 1;
    if (data.approval_status !== undefined) { sets.push(`approval_status = $${idx++}`); vals.push(data.approval_status); }
    if (data.is_active !== undefined) { sets.push(`is_active = $${idx++}`); vals.push(data.is_active); }
    if (data.description !== undefined) { sets.push(`description = $${idx++}`); vals.push(data.description); }
    if (sets.length === 0) return null;
    sets.push(`updated_at = NOW()`);
    vals.push(tenantId, id);
    const result = await query(
      `UPDATE sms_sender_ids SET ${sets.join(', ')} WHERE tenant_id = $${idx++} AND id = $${idx} RETURNING *`,
      vals
    );
    return result.rows[0] || null;
  }

  static async delete(tenantId: string, id: string) {
    const result = await query(`DELETE FROM sms_sender_ids WHERE tenant_id = $1 AND id = $2`, [tenantId, id]);
    return (result.rowCount ?? 0) > 0;
  }

  /** Find best sender ID for a region */
  static async resolveForRegion(tenantId: string, region?: string): Promise<string | null> {
    if (region) {
      const regional = await query(
        `SELECT sender_id FROM sms_sender_ids WHERE tenant_id = $1 AND region = $2 AND is_active = true AND approval_status = 'approved' LIMIT 1`,
        [tenantId, region]
      );
      if (regional.rows[0]) return regional.rows[0].sender_id;
    }
    const fallback = await query(
      `SELECT sender_id FROM sms_sender_ids WHERE tenant_id = $1 AND is_active = true AND approval_status = 'approved' ORDER BY created_at ASC LIMIT 1`,
      [tenantId]
    );
    return fallback.rows[0]?.sender_id || null;
  }
}
