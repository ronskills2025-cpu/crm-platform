import { query } from '../../../packages/db/src/connection';
import { createLogger } from '../../../packages/utils/src/logger';

const log = createLogger('svc:sms-dlt');

export class DLTService {
  // ── DLT Entities ───────────────────────────────────────────────
  static async listEntities(tenantId: string) {
    const result = await query(
      `SELECT * FROM sms_dlt_entities WHERE tenant_id = $1 ORDER BY created_at DESC`,
      [tenantId]
    );
    return result.rows;
  }

  static async createEntity(tenantId: string, data: { entity_name: string; entity_id: string; telecom_circle?: string }) {
    const result = await query(
      `INSERT INTO sms_dlt_entities (tenant_id, entity_name, entity_id, telecom_circle)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [tenantId, data.entity_name, data.entity_id, data.telecom_circle || null]
    );
    return result.rows[0];
  }

  static async updateEntity(tenantId: string, id: string, data: { entity_name?: string; telecom_circle?: string; is_active?: boolean }) {
    const sets: string[] = [];
    const vals: unknown[] = [];
    let idx = 1;
    if (data.entity_name !== undefined) { sets.push(`entity_name = $${idx++}`); vals.push(data.entity_name); }
    if (data.telecom_circle !== undefined) { sets.push(`telecom_circle = $${idx++}`); vals.push(data.telecom_circle); }
    if (data.is_active !== undefined) { sets.push(`is_active = $${idx++}`); vals.push(data.is_active); }
    if (sets.length === 0) return null;
    sets.push(`updated_at = NOW()`);
    vals.push(tenantId, id);
    const result = await query(
      `UPDATE sms_dlt_entities SET ${sets.join(', ')} WHERE tenant_id = $${idx++} AND id = $${idx} RETURNING *`,
      vals
    );
    return result.rows[0] || null;
  }

  static async deleteEntity(tenantId: string, id: string) {
    const result = await query(`DELETE FROM sms_dlt_entities WHERE tenant_id = $1 AND id = $2`, [tenantId, id]);
    return (result.rowCount ?? 0) > 0;
  }

  // ── DLT Templates ─────────────────────────────────────────────
  static async listTemplates(tenantId: string, entityId?: string) {
    let sql = `SELECT t.*, e.entity_name FROM sms_dlt_templates t LEFT JOIN sms_dlt_entities e ON t.entity_id = e.id WHERE t.tenant_id = $1`;
    const params: unknown[] = [tenantId];
    if (entityId) { sql += ` AND t.entity_id = $2`; params.push(entityId); }
    sql += ` ORDER BY t.created_at DESC`;
    const result = await query(sql, params);
    return result.rows;
  }

  static async createTemplate(tenantId: string, data: {
    entity_id: string;
    template_id: string;
    template_name: string;
    content_template: string;
    variables: string[];
    message_type?: string;
  }) {
    const result = await query(
      `INSERT INTO sms_dlt_templates (tenant_id, entity_id, template_id, template_name, content_template, variables, message_type)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [tenantId, data.entity_id, data.template_id, data.template_name, data.content_template, JSON.stringify(data.variables), data.message_type || 'transactional']
    );
    return result.rows[0];
  }

  static async updateTemplate(tenantId: string, id: string, data: { template_name?: string; content_template?: string; variables?: string[]; is_active?: boolean; message_type?: string }) {
    const sets: string[] = [];
    const vals: unknown[] = [];
    let idx = 1;
    if (data.template_name !== undefined) { sets.push(`template_name = $${idx++}`); vals.push(data.template_name); }
    if (data.content_template !== undefined) { sets.push(`content_template = $${idx++}`); vals.push(data.content_template); }
    if (data.variables !== undefined) { sets.push(`variables = $${idx++}`); vals.push(JSON.stringify(data.variables)); }
    if (data.is_active !== undefined) { sets.push(`is_active = $${idx++}`); vals.push(data.is_active); }
    if (data.message_type !== undefined) { sets.push(`message_type = $${idx++}`); vals.push(data.message_type); }
    if (sets.length === 0) return null;
    sets.push(`updated_at = NOW()`);
    vals.push(tenantId, id);
    const result = await query(
      `UPDATE sms_dlt_templates SET ${sets.join(', ')} WHERE tenant_id = $${idx++} AND id = $${idx} RETURNING *`,
      vals
    );
    return result.rows[0] || null;
  }

  static async deleteTemplate(tenantId: string, id: string) {
    const result = await query(`DELETE FROM sms_dlt_templates WHERE tenant_id = $1 AND id = $2`, [tenantId, id]);
    return (result.rowCount ?? 0) > 0;
  }

  /**
   * Validate a message body against a DLT content_template.
   * Template placeholders are {#var#}.
   */
  static validateMessage(contentTemplate: string, message: string): boolean {
    try {
      const escapedTemplate = contentTemplate.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const pattern = escapedTemplate.replace(/\\{#var#\\}/g, '.+');
      return new RegExp(`^${pattern}$`).test(message);
    } catch (err) {
      log.warn('DLT template validation error', { error: String(err) });
      return false;
    }
  }

  /** Resolve the DLT entity ID for a region, falling back to tenant's first active entity */
  static async resolveEntityId(tenantId: string, region?: string): Promise<string | null> {
    if (region) {
      const regional = await query(
        `SELECT entity_id FROM sms_dlt_entities WHERE tenant_id = $1 AND telecom_circle = $2 AND is_active = true LIMIT 1`,
        [tenantId, region]
      );
      if (regional.rows[0]) return regional.rows[0].entity_id;
    }
    const fallback = await query(
      `SELECT entity_id FROM sms_dlt_entities WHERE tenant_id = $1 AND is_active = true ORDER BY created_at ASC LIMIT 1`,
      [tenantId]
    );
    return fallback.rows[0]?.entity_id || null;
  }
}
