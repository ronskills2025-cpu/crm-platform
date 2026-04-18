/**
 * Shared automation product service — registry, config, events, notifications.
 */
import { query } from '../../../packages/db/src/connection';
import { publishEvent } from '../../../packages/db/src/redis';
import { createLogger } from '../../../packages/utils/src/logger';

const log = createLogger('service:products');

export type ProductType = 'funnel' | 'cart_recovery' | 'appointment' | 'payment' | 'review'
  | 'event' | 'catalog' | 'survey' | 'membership';

export interface AutomationProduct {
  id: string;
  tenant_id: string;
  product_type: ProductType;
  name: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ProductEvent {
  id: string;
  tenant_id: string;
  product_id: string;
  product_type: string;
  event_type: string;
  entity_id: string | null;
  entity_type: string | null;
  data: Record<string, unknown>;
  created_at: string;
}

export interface ProductNotification {
  id: string;
  tenant_id: string;
  product_type: string;
  event_type: string;
  title: string;
  message: string;
  entity_id: string | null;
  is_read: boolean;
  priority: string;
  created_at: string;
}

export class ProductService {
  // ── Product CRUD ──────────────────────────────────────────────────────
  static async register(tenantId: string, productType: ProductType, name: string): Promise<AutomationProduct> {
    const res = await query<AutomationProduct>(
      `INSERT INTO automation_products (tenant_id, product_type, name)
       VALUES ($1,$2,$3)
       ON CONFLICT (tenant_id, product_type) DO UPDATE
         SET name = EXCLUDED.name, is_active = true, updated_at = NOW()
       RETURNING *`,
      [tenantId, productType, name]
    );
    return res.rows[0];
  }

  static async listForTenant(tenantId: string): Promise<AutomationProduct[]> {
    const res = await query<AutomationProduct>(
      'SELECT * FROM automation_products WHERE tenant_id = $1 ORDER BY product_type',
      [tenantId]
    );
    return res.rows;
  }

  static async getByType(tenantId: string, productType: ProductType): Promise<AutomationProduct | null> {
    const res = await query<AutomationProduct>(
      'SELECT * FROM automation_products WHERE tenant_id = $1 AND product_type = $2',
      [tenantId, productType]
    );
    return res.rows[0] ?? null;
  }

  static async toggle(id: string): Promise<AutomationProduct | null> {
    const res = await query<AutomationProduct>(
      'UPDATE automation_products SET is_active = NOT is_active, updated_at = NOW() WHERE id = $1 RETURNING *',
      [id]
    );
    return res.rows[0] ?? null;
  }

  static async deleteProduct(id: string): Promise<boolean> {
    const res = await query('DELETE FROM automation_products WHERE id = $1', [id]);
    return (res.rowCount ?? 0) > 0;
  }

  // ── Config ────────────────────────────────────────────────────────────
  static async setConfig(productId: string, key: string, value: unknown): Promise<void> {
    await query(
      `INSERT INTO product_configs (product_id, config_key, config_value)
       VALUES ($1,$2,$3::jsonb)
       ON CONFLICT (product_id, config_key) DO UPDATE
         SET config_value = EXCLUDED.config_value, updated_at = NOW()`,
      [productId, key, JSON.stringify(value)]
    );
  }

  static async getConfig(productId: string, key: string): Promise<unknown | null> {
    const res = await query<{ config_value: unknown }>(
      'SELECT config_value FROM product_configs WHERE product_id = $1 AND config_key = $2',
      [productId, key]
    );
    return res.rows[0]?.config_value ?? null;
  }

  static async getAllConfig(productId: string): Promise<Record<string, unknown>> {
    const res = await query<{ config_key: string; config_value: unknown }>(
      'SELECT config_key, config_value FROM product_configs WHERE product_id = $1',
      [productId]
    );
    const out: Record<string, unknown> = {};
    for (const r of res.rows) out[r.config_key] = r.config_value;
    return out;
  }

  // ── Events ────────────────────────────────────────────────────────────
  static async logEvent(
    tenantId: string, productId: string, productType: string,
    eventType: string, entityId?: string, entityType?: string,
    data?: Record<string, unknown>
  ): Promise<void> {
    await query(
      `INSERT INTO product_events (tenant_id, product_id, product_type, event_type, entity_id, entity_type, data)
       VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb)`,
      [tenantId, productId, productType, eventType, entityId ?? null, entityType ?? null, JSON.stringify(data ?? {})]
    );
    publishEvent(`product:${productType}:${eventType}`, { tenantId, productId, entityId, data });
  }

  static async listEvents(tenantId: string, opts?: {
    productType?: string; limit?: number; offset?: number;
  }): Promise<ProductEvent[]> {
    const conds = ['tenant_id = $1'];
    const params: unknown[] = [tenantId];
    if (opts?.productType) { params.push(opts.productType); conds.push(`product_type = $${params.length}`); }
    params.push(opts?.limit ?? 50);
    params.push(opts?.offset ?? 0);
    const res = await query<ProductEvent>(
      `SELECT * FROM product_events WHERE ${conds.join(' AND ')}
       ORDER BY created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );
    return res.rows;
  }

  // ── Notifications ─────────────────────────────────────────────────────
  static async notify(
    tenantId: string, productType: string, eventType: string,
    title: string, message: string,
    opts?: { entityId?: string; priority?: string }
  ): Promise<void> {
    await query(
      `INSERT INTO product_notifications (tenant_id, product_type, event_type, title, message, entity_id, priority)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [tenantId, productType, eventType, title, message, opts?.entityId ?? null, opts?.priority ?? 'normal']
    );
    publishEvent('product:notification', { tenantId, productType, eventType, title, priority: opts?.priority ?? 'normal' });
  }

  static async listNotifications(tenantId: string, opts?: { unreadOnly?: boolean; limit?: number }): Promise<ProductNotification[]> {
    const conds = ['tenant_id = $1'];
    const params: unknown[] = [tenantId];
    if (opts?.unreadOnly) { conds.push('is_read = false'); }
    params.push(opts?.limit ?? 50);
    const res = await query<ProductNotification>(
      `SELECT * FROM product_notifications WHERE ${conds.join(' AND ')}
       ORDER BY created_at DESC LIMIT $${params.length}`,
      params
    );
    return res.rows;
  }

  static async markNotificationsRead(tenantId: string, ids: string[]): Promise<void> {
    if (!ids.length) return;
    await query(
      'UPDATE product_notifications SET is_read = true WHERE tenant_id = $1 AND id = ANY($2::uuid[])',
      [tenantId, ids]
    );
  }

  // ── Dashboard stats (global) ──────────────────────────────────────────
  static async getDashboardStats(tenantId: string) {
    const [funnel, carts, bookings, payments, reviews, events, orders, surveys, memberships] = await Promise.all([
      query<{ total: string; hot: string; converted: string }>(
        `SELECT COUNT(*) AS total,
                SUM(CASE WHEN status = 'hot' THEN 1 ELSE 0 END) AS hot,
                SUM(CASE WHEN status = 'converted' THEN 1 ELSE 0 END) AS converted
         FROM funnel_leads WHERE tenant_id = $1`, [tenantId]
      ),
      query<{ total: string; recovered: string; revenue: string }>(
        `SELECT COUNT(*) AS total,
                SUM(CASE WHEN status = 'recovered' THEN 1 ELSE 0 END) AS recovered,
                COALESCE(SUM(recovery_value), 0) AS revenue
         FROM cart_sessions WHERE tenant_id = $1`, [tenantId]
      ),
      query<{ total: string; confirmed: string }>(
        `SELECT COUNT(*) AS total,
                SUM(CASE WHEN status = 'confirmed' THEN 1 ELSE 0 END) AS confirmed
         FROM bookings WHERE tenant_id = $1`, [tenantId]
      ),
      query<{ total: string; collected: string; total_due: string }>(
        `SELECT COUNT(*) AS total,
                COALESCE(SUM(amount_paid), 0) AS collected,
                COALESCE(SUM(amount_due), 0) AS total_due
         FROM payment_collections WHERE tenant_id = $1`, [tenantId]
      ),
      query<{ total: string; avg_rating: string }>(
        `SELECT COUNT(*) AS total, COALESCE(AVG(rating), 0) AS avg_rating
         FROM reviews WHERE tenant_id = $1 AND rating IS NOT NULL`, [tenantId]
      ),
      query<{ total: string; upcoming: string; attended: string }>(
        `SELECT COUNT(*) AS total,
                SUM(CASE WHEN e.status = 'upcoming' THEN 1 ELSE 0 END) AS upcoming,
                SUM(CASE WHEN r.status = 'attended' THEN 1 ELSE 0 END) AS attended
         FROM events e LEFT JOIN event_registrations r ON r.event_id = e.id
         WHERE e.tenant_id = $1`, [tenantId]
      ),
      query<{ total: string; paid: string; revenue: string }>(
        `SELECT COUNT(*) AS total,
                SUM(CASE WHEN status = 'paid' OR status = 'delivered' THEN 1 ELSE 0 END) AS paid,
                COALESCE(SUM(CASE WHEN payment_status = 'paid' THEN total_amount ELSE 0 END), 0) AS revenue
         FROM catalog_orders WHERE tenant_id = $1`, [tenantId]
      ),
      query<{ total: string; completed: string; avg_sentiment: string }>(
        `SELECT COUNT(*) AS total,
                SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS completed,
                COALESCE(AVG(CASE WHEN sentiment = 'positive' THEN 5 WHEN sentiment = 'neutral' THEN 3 WHEN sentiment = 'negative' THEN 1 END), 0) AS avg_sentiment
         FROM survey_responses WHERE tenant_id = $1`, [tenantId]
      ),
      query<{ total: string; active: string; expiring: string }>(
        `SELECT COUNT(*) AS total,
                SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) AS active,
                SUM(CASE WHEN status = 'expiring' THEN 1 ELSE 0 END) AS expiring
         FROM memberships WHERE tenant_id = $1`, [tenantId]
      ),
    ]);

    return {
      funnel: {
        totalLeads: parseInt(funnel.rows[0]?.total ?? '0'),
        hotLeads: parseInt(funnel.rows[0]?.hot ?? '0'),
        converted: parseInt(funnel.rows[0]?.converted ?? '0'),
      },
      cartRecovery: {
        total: parseInt(carts.rows[0]?.total ?? '0'),
        recovered: parseInt(carts.rows[0]?.recovered ?? '0'),
        revenue: parseFloat(carts.rows[0]?.revenue ?? '0'),
      },
      appointments: {
        total: parseInt(bookings.rows[0]?.total ?? '0'),
        confirmed: parseInt(bookings.rows[0]?.confirmed ?? '0'),
      },
      payments: {
        total: parseInt(payments.rows[0]?.total ?? '0'),
        collected: parseFloat(payments.rows[0]?.collected ?? '0'),
        totalDue: parseFloat(payments.rows[0]?.total_due ?? '0'),
      },
      reviews: {
        total: parseInt(reviews.rows[0]?.total ?? '0'),
        avgRating: parseFloat(parseFloat(reviews.rows[0]?.avg_rating ?? '0').toFixed(1)),
      },
      events: {
        total: parseInt(events.rows[0]?.total ?? '0'),
        upcoming: parseInt(events.rows[0]?.upcoming ?? '0'),
        attended: parseInt(events.rows[0]?.attended ?? '0'),
      },
      catalog: {
        totalOrders: parseInt(orders.rows[0]?.total ?? '0'),
        paidOrders: parseInt(orders.rows[0]?.paid ?? '0'),
        revenue: parseFloat(orders.rows[0]?.revenue ?? '0'),
      },
      surveys: {
        totalResponses: parseInt(surveys.rows[0]?.total ?? '0'),
        completed: parseInt(surveys.rows[0]?.completed ?? '0'),
        avgSentiment: parseFloat(parseFloat(surveys.rows[0]?.avg_sentiment ?? '0').toFixed(1)),
      },
      memberships: {
        total: parseInt(memberships.rows[0]?.total ?? '0'),
        active: parseInt(memberships.rows[0]?.active ?? '0'),
        expiring: parseInt(memberships.rows[0]?.expiring ?? '0'),
      },
    };
  }
}
