/**
 * Review Collector service — trigger post-service, collect ratings, redirect or escalate.
 */
import { query } from '../../../packages/db/src/connection';
import { ProductService } from './product.service';
import { createLogger } from '../../../packages/utils/src/logger';

const log = createLogger('service:review');

export interface Review {
  id: string;
  tenant_id: string;
  product_id: string;
  customer_name: string | null;
  customer_phone: string;
  rating: number | null;
  feedback: string | null;
  status: string;
  google_review_url: string | null;
  redirect_sent: boolean;
  followup_count: number;
  last_followup_at: string | null;
  rated_at: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export class ReviewService {
  // ── Create review request ─────────────────────────────────────────────
  static async create(tenantId: string, productId: string, data: {
    customer_name?: string; customer_phone: string; google_review_url?: string;
    metadata?: Record<string, unknown>;
  }): Promise<Review> {
    const res = await query<Review>(
      `INSERT INTO reviews (tenant_id, product_id, customer_name, customer_phone, google_review_url, metadata)
       VALUES ($1,$2,$3,$4,$5,$6::jsonb) RETURNING *`,
      [tenantId, productId, data.customer_name ?? null, data.customer_phone,
       data.google_review_url ?? null, JSON.stringify(data.metadata ?? {})]
    );
    return res.rows[0];
  }

  // ── List ──────────────────────────────────────────────────────────────
  static async list(tenantId: string, opts?: {
    status?: string; limit?: number; offset?: number;
  }): Promise<{ reviews: Review[]; total: number }> {
    const conds = ['tenant_id = $1'];
    const params: unknown[] = [tenantId];
    if (opts?.status) { params.push(opts.status); conds.push(`status = $${params.length}`); }
    const where = conds.join(' AND ');
    const limit = opts?.limit ?? 50;
    const offset = opts?.offset ?? 0;
    params.push(limit, offset);

    const [rows, cnt] = await Promise.all([
      query<Review>(`SELECT * FROM reviews WHERE ${where} ORDER BY created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`, params),
      query<{ count: string }>(`SELECT COUNT(*) AS count FROM reviews WHERE ${where}`, params.slice(0, -2)),
    ]);
    return { reviews: rows.rows, total: parseInt(cnt.rows[0]?.count ?? '0') };
  }

  static async getById(id: string): Promise<Review | null> {
    const res = await query<Review>('SELECT * FROM reviews WHERE id = $1', [id]);
    return res.rows[0] ?? null;
  }

  // ── Submit rating ─────────────────────────────────────────────────────
  static async submitRating(id: string, rating: number, feedback?: string): Promise<Review | null> {
    const newStatus = rating >= 4 ? 'rated' : 'escalated';

    const res = await query<Review>(
      `UPDATE reviews SET rating = $1, feedback = $2, status = $3,
         rated_at = NOW(), updated_at = NOW()
       WHERE id = $4 RETURNING *`,
      [rating, feedback ?? null, newStatus, id]
    );
    const review = res.rows[0];
    if (!review) return null;

    await ProductService.logEvent(review.tenant_id, review.product_id, 'review', 'rating_submitted',
      id, 'review', { rating, feedback });

    // High rating → redirect to Google
    if (rating >= 4 && review.google_review_url) {
      await query('UPDATE reviews SET redirect_sent = true, status = $1, updated_at = NOW() WHERE id = $2', ['redirected', id]);
    }

    // Low rating → escalate + notify
    if (rating <= 3) {
      await ProductService.notify(review.tenant_id, 'review', 'negative_review',
        'Negative Review Alert',
        `${review.customer_name ?? review.customer_phone} rated ${rating}/5: ${feedback ?? 'No feedback'}`,
        { entityId: id, priority: 'high' });
    }

    return review;
  }

  // ── Follow-up tracking ────────────────────────────────────────────────
  static async recordFollowup(id: string): Promise<void> {
    await query(
      `UPDATE reviews SET followup_count = followup_count + 1,
         last_followup_at = NOW(), updated_at = NOW() WHERE id = $1`,
      [id]
    );
  }

  // ── Get pending reviews that need follow-up ───────────────────────────
  static async getPendingFollowups(): Promise<Review[]> {
    const res = await query<Review>(
      `SELECT * FROM reviews
       WHERE status = 'pending' AND followup_count < 3
         AND (last_followup_at IS NULL OR last_followup_at < NOW() - INTERVAL '24 hours')
       ORDER BY created_at
       LIMIT 100`
    );
    return res.rows;
  }

  // ── Stats ─────────────────────────────────────────────────────────────
  static async getStats(tenantId: string) {
    const res = await query<{
      total: string; pending: string; rated: string; redirected: string;
      escalated: string; no_response: string;
      avg_rating: string; rating_5: string; rating_4: string;
      rating_3: string; rating_2: string; rating_1: string;
    }>(
      `SELECT COUNT(*) AS total,
              SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS pending,
              SUM(CASE WHEN status = 'rated' THEN 1 ELSE 0 END) AS rated,
              SUM(CASE WHEN status = 'redirected' THEN 1 ELSE 0 END) AS redirected,
              SUM(CASE WHEN status = 'escalated' THEN 1 ELSE 0 END) AS escalated,
              SUM(CASE WHEN status = 'no_response' THEN 1 ELSE 0 END) AS no_response,
              COALESCE(AVG(rating), 0) AS avg_rating,
              SUM(CASE WHEN rating = 5 THEN 1 ELSE 0 END) AS rating_5,
              SUM(CASE WHEN rating = 4 THEN 1 ELSE 0 END) AS rating_4,
              SUM(CASE WHEN rating = 3 THEN 1 ELSE 0 END) AS rating_3,
              SUM(CASE WHEN rating = 2 THEN 1 ELSE 0 END) AS rating_2,
              SUM(CASE WHEN rating = 1 THEN 1 ELSE 0 END) AS rating_1
       FROM reviews WHERE tenant_id = $1`,
      [tenantId]
    );
    const r = res.rows[0];
    const total = parseInt(r?.total ?? '0');
    const rated = parseInt(r?.rated ?? '0') + parseInt(r?.redirected ?? '0') + parseInt(r?.escalated ?? '0');
    return {
      total,
      pending: parseInt(r?.pending ?? '0'),
      rated: parseInt(r?.rated ?? '0'),
      redirected: parseInt(r?.redirected ?? '0'),
      escalated: parseInt(r?.escalated ?? '0'),
      noResponse: parseInt(r?.no_response ?? '0'),
      responseRate: total > 0 ? Math.round((rated / total) * 100) : 0,
      avgRating: parseFloat(parseFloat(r?.avg_rating ?? '0').toFixed(1)),
      distribution: {
        5: parseInt(r?.rating_5 ?? '0'),
        4: parseInt(r?.rating_4 ?? '0'),
        3: parseInt(r?.rating_3 ?? '0'),
        2: parseInt(r?.rating_2 ?? '0'),
        1: parseInt(r?.rating_1 ?? '0'),
      },
      satisfactionScore: total > 0
        ? Math.round(((parseInt(r?.rating_5 ?? '0') + parseInt(r?.rating_4 ?? '0')) / Math.max(rated, 1)) * 100)
        : 0,
    };
  }
}
