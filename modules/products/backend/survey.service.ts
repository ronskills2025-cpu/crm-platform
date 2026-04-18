/**
 * Feedback Survey Bot service — surveys, questions, responses, sentiment, reporting.
 */
import { query } from '../../../packages/db/src/connection';
import { ProductService } from './product.service';
import { createLogger } from '../../../packages/utils/src/logger';

const log = createLogger('service:survey');

export interface Survey {
  id: string; tenant_id: string; product_id: string;
  title: string; description: string | null; status: string;
  response_count: number; metadata: Record<string, unknown>;
  created_at: string; updated_at: string;
}

export interface SurveyQuestion {
  id: string; survey_id: string; question_order: number;
  question_type: string; question_text: string;
  options: unknown[]; is_required: boolean;
  condition: Record<string, unknown> | null;
  created_at: string;
}

export interface SurveyResponse {
  id: string; survey_id: string; tenant_id: string;
  customer_name: string | null; customer_phone: string;
  status: string; answers: Record<string, unknown>;
  sentiment: string | null; completed_at: string | null;
  metadata: Record<string, unknown>;
  created_at: string; updated_at: string;
}

export class SurveyService {
  // ── Survey CRUD ───────────────────────────────────────────────────
  static async createSurvey(tenantId: string, productId: string, data: {
    title: string; description?: string; metadata?: Record<string, unknown>;
  }): Promise<Survey> {
    const res = await query<Survey>(
      `INSERT INTO surveys (tenant_id, product_id, title, description, metadata)
       VALUES ($1,$2,$3,$4,$5::jsonb) RETURNING *`,
      [tenantId, productId, data.title, data.description ?? null,
       JSON.stringify(data.metadata ?? {})]
    );
    await ProductService.logEvent(tenantId, productId, 'survey', 'survey_created', res.rows[0].id, 'survey');
    return res.rows[0];
  }

  static async listSurveys(tenantId: string, opts?: {
    status?: string; limit?: number; offset?: number;
  }): Promise<{ surveys: Survey[]; total: number }> {
    const conds = ['tenant_id = $1'];
    const params: unknown[] = [tenantId];
    if (opts?.status) { params.push(opts.status); conds.push(`status = $${params.length}`); }
    const where = conds.join(' AND ');
    params.push(opts?.limit ?? 50, opts?.offset ?? 0);
    const [rows, cnt] = await Promise.all([
      query<Survey>(`SELECT * FROM surveys WHERE ${where} ORDER BY created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`, params),
      query<{ count: string }>(`SELECT COUNT(*) AS count FROM surveys WHERE ${where}`, params.slice(0, -2)),
    ]);
    return { surveys: rows.rows, total: parseInt(cnt.rows[0]?.count ?? '0') };
  }

  static async getSurvey(id: string): Promise<Survey | null> {
    const res = await query<Survey>('SELECT * FROM surveys WHERE id = $1', [id]);
    return res.rows[0] ?? null;
  }

  static async updateSurvey(id: string, data: Partial<{
    title: string; description: string; status: string;
  }>): Promise<Survey | null> {
    const sets: string[] = []; const params: unknown[] = [];
    for (const [k, v] of Object.entries(data)) {
      params.push(v); sets.push(`${k} = $${params.length}`);
    }
    if (!sets.length) return this.getSurvey(id);
    sets.push('updated_at = NOW()');
    params.push(id);
    const res = await query<Survey>(
      `UPDATE surveys SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING *`, params
    );
    return res.rows[0] ?? null;
  }

  static async deleteSurvey(id: string): Promise<boolean> {
    const res = await query('DELETE FROM surveys WHERE id = $1', [id]);
    return (res.rowCount ?? 0) > 0;
  }

  // ── Questions ─────────────────────────────────────────────────────
  static async upsertQuestion(surveyId: string, data: {
    question_order: number; question_type: string; question_text: string;
    options?: unknown[]; is_required?: boolean; condition?: Record<string, unknown>;
  }): Promise<SurveyQuestion> {
    const res = await query<SurveyQuestion>(
      `INSERT INTO survey_questions (survey_id, question_order, question_type, question_text, options, is_required, condition)
       VALUES ($1,$2,$3,$4,$5::jsonb,$6,$7::jsonb)
       ON CONFLICT (survey_id, question_order) DO UPDATE
         SET question_type = EXCLUDED.question_type, question_text = EXCLUDED.question_text,
             options = EXCLUDED.options, is_required = EXCLUDED.is_required,
             condition = EXCLUDED.condition
       RETURNING *`,
      [surveyId, data.question_order, data.question_type, data.question_text,
       JSON.stringify(data.options ?? []), data.is_required ?? true,
       data.condition ? JSON.stringify(data.condition) : null]
    );
    return res.rows[0];
  }

  static async listQuestions(surveyId: string): Promise<SurveyQuestion[]> {
    const res = await query<SurveyQuestion>(
      'SELECT * FROM survey_questions WHERE survey_id = $1 ORDER BY question_order', [surveyId]
    );
    return res.rows;
  }

  static async deleteQuestion(id: string): Promise<boolean> {
    const res = await query('DELETE FROM survey_questions WHERE id = $1', [id]);
    return (res.rowCount ?? 0) > 0;
  }

  // ── Responses ─────────────────────────────────────────────────────
  static async startResponse(surveyId: string, tenantId: string, data: {
    customer_name?: string; customer_phone: string;
    metadata?: Record<string, unknown>;
  }): Promise<SurveyResponse> {
    const res = await query<SurveyResponse>(
      `INSERT INTO survey_responses (survey_id, tenant_id, customer_name, customer_phone, metadata)
       VALUES ($1,$2,$3,$4,$5::jsonb) RETURNING *`,
      [surveyId, tenantId, data.customer_name ?? null, data.customer_phone,
       JSON.stringify(data.metadata ?? {})]
    );
    return res.rows[0];
  }

  static async submitAnswer(responseId: string, questionId: string, answer: unknown): Promise<SurveyResponse | null> {
    const existing = await query<SurveyResponse>('SELECT * FROM survey_responses WHERE id = $1', [responseId]);
    const resp = existing.rows[0];
    if (!resp) return null;
    const answers = { ...(resp.answers as Record<string, unknown>), [questionId]: answer };
    const result = await query<SurveyResponse>(
      `UPDATE survey_responses SET answers = $1::jsonb, status = 'partial', updated_at = NOW()
       WHERE id = $2 RETURNING *`,
      [JSON.stringify(answers), responseId]
    );
    return result.rows[0] ?? null;
  }

  static async completeResponse(responseId: string, sentiment?: string): Promise<SurveyResponse | null> {
    const res = await query<SurveyResponse>(
      `UPDATE survey_responses SET status = 'completed', sentiment = $1, completed_at = NOW(), updated_at = NOW()
       WHERE id = $2 RETURNING *`,
      [sentiment ?? null, responseId]
    );
    const resp = res.rows[0];
    if (resp) {
      await query('UPDATE surveys SET response_count = response_count + 1, updated_at = NOW() WHERE id = $1', [resp.survey_id]);
      const survey = await this.getSurvey(resp.survey_id);
      if (survey) {
        await ProductService.logEvent(resp.tenant_id!, survey.product_id, 'survey', 'response_completed',
          responseId, 'survey_response', { sentiment });
        if (sentiment === 'negative') {
          await ProductService.notify(resp.tenant_id!, 'survey', 'negative_response',
            'Negative Survey Response',
            `${resp.customer_name ?? resp.customer_phone} submitted a negative response to "${survey.title}"`,
            { entityId: responseId, priority: 'high' });
        }
      }
    }
    return resp;
  }

  static async listResponses(surveyId: string, opts?: {
    status?: string; limit?: number; offset?: number;
  }): Promise<{ responses: SurveyResponse[]; total: number }> {
    const conds = ['survey_id = $1'];
    const params: unknown[] = [surveyId];
    if (opts?.status) { params.push(opts.status); conds.push(`status = $${params.length}`); }
    const where = conds.join(' AND ');
    params.push(opts?.limit ?? 50, opts?.offset ?? 0);
    const [rows, cnt] = await Promise.all([
      query<SurveyResponse>(`SELECT * FROM survey_responses WHERE ${where} ORDER BY created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`, params),
      query<{ count: string }>(`SELECT COUNT(*) AS count FROM survey_responses WHERE ${where}`, params.slice(0, -2)),
    ]);
    return { responses: rows.rows, total: parseInt(cnt.rows[0]?.count ?? '0') };
  }

  // ── Worker helpers ────────────────────────────────────────────────
  static async getPendingFollowups(): Promise<(SurveyResponse & { survey_title: string })[]> {
    const res = await query<SurveyResponse & { survey_title: string }>(
      `SELECT r.*, s.title AS survey_title
       FROM survey_responses r JOIN surveys s ON s.id = r.survey_id
       WHERE r.status = 'pending' AND s.status = 'active'
         AND r.created_at < NOW() - INTERVAL '4 hours'`,
      []
    );
    return res.rows;
  }

  // ── Stats ─────────────────────────────────────────────────────────
  static async getStats(tenantId: string) {
    const res = await query<{
      total_surveys: string; active_surveys: string;
      total_responses: string; completed: string; pending: string;
      positive: string; neutral: string; negative: string;
    }>(
      `SELECT
         (SELECT COUNT(*) FROM surveys WHERE tenant_id = $1) AS total_surveys,
         (SELECT COUNT(*) FROM surveys WHERE tenant_id = $1 AND status = 'active') AS active_surveys,
         COUNT(r.id) AS total_responses,
         SUM(CASE WHEN r.status = 'completed' THEN 1 ELSE 0 END) AS completed,
         SUM(CASE WHEN r.status = 'pending' THEN 1 ELSE 0 END) AS pending,
         SUM(CASE WHEN r.sentiment = 'positive' THEN 1 ELSE 0 END) AS positive,
         SUM(CASE WHEN r.sentiment = 'neutral' THEN 1 ELSE 0 END) AS neutral,
         SUM(CASE WHEN r.sentiment = 'negative' THEN 1 ELSE 0 END) AS negative
       FROM survey_responses r JOIN surveys s ON s.id = r.survey_id
       WHERE s.tenant_id = $1`,
      [tenantId]
    );
    const r = res.rows[0];
    const completed = parseInt(r?.completed ?? '0');
    const total = parseInt(r?.total_responses ?? '0');
    return {
      totalSurveys: parseInt(r?.total_surveys ?? '0'),
      activeSurveys: parseInt(r?.active_surveys ?? '0'),
      totalResponses: total,
      completed,
      pending: parseInt(r?.pending ?? '0'),
      completionRate: total > 0 ? Math.round((completed / total) * 100) : 0,
      sentimentBreakdown: {
        positive: parseInt(r?.positive ?? '0'),
        neutral: parseInt(r?.neutral ?? '0'),
        negative: parseInt(r?.negative ?? '0'),
      },
    };
  }
}
