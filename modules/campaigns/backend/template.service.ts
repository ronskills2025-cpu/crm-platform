import { query } from '../../../packages/db/src/connection';
import { createLogger } from '../../../packages/utils/src/logger';

const log = createLogger('service:template');

export interface WabaTemplate {
  id: string;
  tenant_id: string | null;
  name: string;
  category: 'MARKETING' | 'UTILITY' | 'AUTHENTICATION';
  language: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'DISABLED';
  header_type: string | null;
  header_content: string | null;
  body: string;
  footer: string | null;
  buttons: unknown[];
  variables: string[];
  meta_template_id: string | null;
  created_at: string;
  updated_at: string;
}

interface TemplateInput {
  name: string;
  category?: string;
  language?: string;
  headerType?: string;
  headerContent?: string;
  body: string;
  footer?: string;
  buttons?: unknown[];
  variables?: string[];
}

export class TemplateService {
  static async create(tenantId: string | null, data: TemplateInput): Promise<WabaTemplate> {
    // Parse {{variable}} from body
    const vars = data.variables ?? [...data.body.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]);

    const res = await query<WabaTemplate>(
      `INSERT INTO waba_templates
         (tenant_id, name, category, language, header_type, header_content, body, footer, buttons, variables)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [
        tenantId,
        data.name,
        (data.category ?? 'MARKETING').toUpperCase(),
        data.language ?? 'en_US',
        data.headerType ?? null,
        data.headerContent ?? null,
        data.body,
        data.footer ?? null,
        JSON.stringify(data.buttons ?? []),
        JSON.stringify(vars),
      ]
    );
    return res.rows[0];
  }

  static async list(tenantId: string | null, params?: {
    status?: string;
    category?: string;
    search?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ templates: WabaTemplate[]; total: number }> {
    const whereClauses: string[] = [];
    const paramList: unknown[] = [];
    let idx = 1;

    if (tenantId) { whereClauses.push(`tenant_id = $${idx++}`); paramList.push(tenantId); }
    if (params?.status) { whereClauses.push(`status = $${idx++}`); paramList.push(params.status.toUpperCase()); }
    if (params?.category) { whereClauses.push(`category = $${idx++}`); paramList.push(params.category.toUpperCase()); }
    if (params?.search) { whereClauses.push(`name ILIKE $${idx++}`); paramList.push(`%${params.search}%`); }

    const where = whereClauses.length ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const limit = params?.limit ?? 50;
    const offset = params?.offset ?? 0;

    const [rows, count] = await Promise.all([
      query<WabaTemplate>(
        `SELECT * FROM waba_templates ${where} ORDER BY created_at DESC LIMIT $${idx++} OFFSET $${idx++}`,
        [...paramList, limit, offset]
      ),
      query<{ count: string }>(`SELECT COUNT(*) AS count FROM waba_templates ${where}`, paramList),
    ]);

    return { templates: rows.rows, total: parseInt(count.rows[0]?.count ?? '0') };
  }

  static async getById(tenantId: string | null, id: string): Promise<WabaTemplate | null> {
    const params: unknown[] = [id];
    let where = `WHERE id = $1`;
    if (tenantId) { where += ` AND tenant_id = $2`; params.push(tenantId); }

    const res = await query<WabaTemplate>(`SELECT * FROM waba_templates ${where}`, params);
    return res.rows[0] ?? null;
  }

  static async update(tenantId: string | null, id: string, data: Partial<TemplateInput>): Promise<WabaTemplate | null> {
    const sets: string[] = [];
    const vals: unknown[] = [];
    let i = 1;

    if (data.name !== undefined)          { sets.push(`name = $${i++}`);           vals.push(data.name); }
    if (data.category !== undefined)      { sets.push(`category = $${i++}`);       vals.push(data.category.toUpperCase()); }
    if (data.language !== undefined)      { sets.push(`language = $${i++}`);       vals.push(data.language); }
    if (data.body !== undefined)          { sets.push(`body = $${i++}`);           vals.push(data.body); }
    if (data.footer !== undefined)        { sets.push(`footer = $${i++}`);         vals.push(data.footer); }
    if (data.headerType !== undefined)    { sets.push(`header_type = $${i++}`);    vals.push(data.headerType); }
    if (data.headerContent !== undefined) { sets.push(`header_content = $${i++}`); vals.push(data.headerContent); }
    if (data.buttons !== undefined)       { sets.push(`buttons = $${i++}`);        vals.push(JSON.stringify(data.buttons)); }
    if (data.variables !== undefined)     { sets.push(`variables = $${i++}`);      vals.push(JSON.stringify(data.variables)); }

    if (sets.length === 0) return TemplateService.getById(tenantId, id);

    // Reset to pending when content changes
    sets.push(`status = 'PENDING'`);
    sets.push(`meta_template_id = NULL`);
    sets.push(`updated_at = NOW()`);

    vals.push(id);
    let where = `WHERE id = $${i++}`;
    if (tenantId) { where += ` AND tenant_id = $${i++}`; vals.push(tenantId); }

    const res = await query<WabaTemplate>(
      `UPDATE waba_templates SET ${sets.join(', ')} ${where} RETURNING *`,
      vals
    );
    return res.rows[0] ?? null;
  }

  static async delete(tenantId: string | null, id: string): Promise<boolean> {
    const params: unknown[] = [id];
    let where = `WHERE id = $1`;
    if (tenantId) { where += ` AND tenant_id = $2`; params.push(tenantId); }

    const res = await query(`DELETE FROM waba_templates ${where}`, params);
    return (res.rowCount ?? 0) > 0;
  }

  /**
   * Submit template to Meta WhatsApp Business API for approval.
   * Requires the tenant's number access token.
   */
  static async submitToMeta(
    accessToken: string,
    wabaId: string,
    templateId: string,
    tenantId: string | null
  ): Promise<{ success: boolean; metaTemplateId?: string; error?: string }> {
    const tpl = await TemplateService.getById(tenantId, templateId);
    if (!tpl) return { success: false, error: 'Template not found' };

    const components: unknown[] = [];
    if (tpl.header_type && tpl.header_type !== 'NONE' && tpl.header_content) {
      components.push({ type: 'HEADER', format: tpl.header_type, text: tpl.header_content });
    }
    components.push({ type: 'BODY', text: tpl.body });
    if (tpl.footer) components.push({ type: 'FOOTER', text: tpl.footer });
    if (Array.isArray(tpl.buttons) && tpl.buttons.length > 0) {
      components.push({ type: 'BUTTONS', buttons: tpl.buttons });
    }

    try {
      const resp = await fetch(
        `https://graph.facebook.com/v21.0/${wabaId}/message_templates`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: tpl.name,
            category: tpl.category,
            language: tpl.language,
            components,
          }),
        }
      );
      const json = (await resp.json()) as { id?: string; error?: { message: string } };

      if (!resp.ok || json.error) {
        return { success: false, error: json.error?.message ?? 'Meta API error' };
      }

      await query(
        `UPDATE waba_templates SET meta_template_id = $1, status = 'PENDING', updated_at = NOW() WHERE id = $2`,
        [json.id, templateId]
      );
      return { success: true, metaTemplateId: json.id };
    } catch (err) {
      log.error('Meta template submit failed', err);
      return { success: false, error: (err as Error).message };
    }
  }

  /** Sync template status from Meta */
  static async syncStatus(templateId: string, status: string, metaId?: string): Promise<void> {
    const normalised = ['APPROVED', 'REJECTED', 'PENDING', 'DISABLED'].includes(status.toUpperCase())
      ? status.toUpperCase()
      : 'PENDING';
    await query(
      `UPDATE waba_templates
       SET status = $1, meta_template_id = COALESCE($2, meta_template_id), updated_at = NOW()
       WHERE id = $3`,
      [normalised, metaId ?? null, templateId]
    );
  }
}
