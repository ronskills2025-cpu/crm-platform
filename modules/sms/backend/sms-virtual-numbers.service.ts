import { query } from '../../../packages/db/src/connection';

export class VirtualNumberService {
  static async list(tenantId: string) {
    const result = await query(
      `SELECT * FROM sms_virtual_numbers WHERE tenant_id = $1 ORDER BY created_at DESC`,
      [tenantId]
    );
    return result.rows;
  }

  static async create(tenantId: string, data: {
    phone_number: string;
    provider: string;
    region?: string;
    capabilities?: string[];
  }) {
    const result = await query(
      `INSERT INTO sms_virtual_numbers (tenant_id, phone_number, provider, region, capabilities)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [tenantId, data.phone_number, data.provider, data.region || null, JSON.stringify(data.capabilities || ['sms'])]
    );
    return result.rows[0];
  }

  static async update(tenantId: string, id: string, data: { is_active?: boolean; capabilities?: string[] }) {
    const sets: string[] = [];
    const vals: unknown[] = [];
    let idx = 1;
    if (data.is_active !== undefined) { sets.push(`is_active = $${idx++}`); vals.push(data.is_active); }
    if (data.capabilities !== undefined) { sets.push(`capabilities = $${idx++}`); vals.push(JSON.stringify(data.capabilities)); }
    if (sets.length === 0) return null;
    sets.push(`updated_at = NOW()`);
    vals.push(tenantId, id);
    const result = await query(
      `UPDATE sms_virtual_numbers SET ${sets.join(', ')} WHERE tenant_id = $${idx++} AND id = $${idx} RETURNING *`,
      vals
    );
    return result.rows[0] || null;
  }

  static async delete(tenantId: string, id: string) {
    const result = await query(`DELETE FROM sms_virtual_numbers WHERE tenant_id = $1 AND id = $2`, [tenantId, id]);
    return (result.rowCount ?? 0) > 0;
  }
}
