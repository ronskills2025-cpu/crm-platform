import crypto from 'crypto';
import { query } from '../../../packages/db/src/connection';
import { config } from '../../../packages/config/src/config';
import { cartRecoveryQueue } from '../../../packages/utils/src/queues';
import { createLogger } from '../../../packages/utils/src/logger';

const log = createLogger('service:cart-recovery');

export interface CartSession {
  id: string;
  tenant_id: string | null;
  shop_domain: string;
  cart_token: string;
  customer_phone: string | null;
  customer_email: string | null;
  customer_name: string | null;
  cart_value: number;
  currency: string;
  items: CartItem[];
  checkout_url: string | null;
  status: 'abandoned' | 'recovered' | 'expired';
  first_message_sent_at: string | null;
  followup_sent_at: string | null;
  recovered_at: string | null;
  recovery_order_id: string | null;
  recovery_value: number | null;
  created_at: string;
  updated_at: string;
}

export interface CartItem {
  product_id: string | number;
  title: string;
  quantity: number;
  price: number;
  variant_title?: string;
  image_url?: string;
}

export interface ShopifyCartPayload {
  token: string;
  email?: string;
  phone?: string;
  created_at: string;
  updated_at: string;
  total_price?: string;
  currency?: string;
  line_items?: Array<{
    product_id: number;
    title: string;
    quantity: number;
    price: string;
    variant_title?: string;
  }>;
  checkout_url?: string;
  customer?: {
    email?: string;
    phone?: string;
    first_name?: string;
    last_name?: string;
  };
}

// ── HMAC verification ─────────────────────────────────────────────────────────

export function verifyShopifyWebhook(rawBody: Buffer, hmacHeader: string): boolean {
  if (!config.shopify.webhookSecret) return true; // skip verification if not configured
  const digest = crypto
    .createHmac('sha256', config.shopify.webhookSecret)
    .update(rawBody)
    .digest('base64');
  return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(hmacHeader));
}

// ── Service ───────────────────────────────────────────────────────────────────

export class CartRecoveryService {
  /** Handle incoming Shopify cart_abandoned webhook */
  static async handleAbandoned(tenantId: string | null, payload: ShopifyCartPayload, shopDomain: string): Promise<CartSession> {
    const customer = payload.customer;
    const phone = payload.phone ?? customer?.phone ?? null;
    const email = payload.email ?? customer?.email ?? null;
    const name = customer
      ? [customer.first_name, customer.last_name].filter(Boolean).join(' ') || null
      : null;

    const items: CartItem[] = (payload.line_items ?? []).map((li) => ({
      product_id: li.product_id,
      title: li.title,
      quantity: li.quantity,
      price: parseFloat(li.price ?? '0'),
      variant_title: li.variant_title,
    }));

    const cartValue = parseFloat(payload.total_price ?? '0') || items.reduce((s, i) => s + i.price * i.quantity, 0);

    const res = await query<CartSession>(
      `INSERT INTO cart_sessions
         (tenant_id, shop_domain, cart_token, customer_phone, customer_email,
          customer_name, cart_value, currency, items, checkout_url)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       ON CONFLICT (tenant_id, cart_token) DO UPDATE
         SET customer_phone  = EXCLUDED.customer_phone,
             customer_email  = EXCLUDED.customer_email,
             customer_name   = EXCLUDED.customer_name,
             cart_value      = EXCLUDED.cart_value,
             currency        = EXCLUDED.currency,
             items           = EXCLUDED.items,
             checkout_url    = EXCLUDED.checkout_url,
             status          = 'abandoned',
             updated_at      = NOW()
       RETURNING *`,
      [
        tenantId ?? null,
        shopDomain,
        payload.token,
        phone,
        email,
        name,
        cartValue,
        payload.currency ?? 'INR',
        JSON.stringify(items),
        payload.checkout_url ?? null,
      ]
    );

    const session = res.rows[0];

    // Only queue recovery if we have a phone number to message
    if (phone) {
      await CartRecoveryService._queueRecovery(session.id, tenantId, phone, session.checkout_url, items, cartValue, currency(session), name);
    }

    return session;
  }

  private static _queueRecovery(
    sessionId: string,
    tenantId: string | null,
    phone: string,
    checkoutUrl: string | null,
    items: CartItem[],
    cartValue: number,
    currencyCode: string,
    customerName: string | null
  ) {
    return Promise.all([
      cartRecoveryQueue.add(
        'cart_recovery_first',
        { sessionId, tenantId, phone, checkoutUrl, items, cartValue, currency: currencyCode, customerName, sequence: 1 },
        { delay: config.shopify.cartRecoveryDelayMs, jobId: `cr1-${sessionId}` }
      ),
      cartRecoveryQueue.add(
        'cart_recovery_followup',
        { sessionId, tenantId, phone, checkoutUrl, items, cartValue, currency: currencyCode, customerName, sequence: 2 },
        { delay: config.shopify.cartFollowupDelayMs, jobId: `cr2-${sessionId}` }
      ),
    ]);
  }

  /** Mark a cart as recovered (called by Shopify order webhook or manual) */
  static async markRecovered(tenantId: string | null, cartToken: string, orderId: string, orderValue: number): Promise<void> {
    const res = await query<{ id: string }>(
      `UPDATE cart_sessions
         SET status = 'recovered', recovery_order_id = $1, recovery_value = $2,
             recovered_at = NOW(), updated_at = NOW()
       WHERE cart_token = $3 ${tenantId ? 'AND tenant_id = $4' : ''}
       RETURNING id`,
      tenantId ? [orderId, orderValue, cartToken, tenantId] : [orderId, orderValue, cartToken]
    );

    if (res.rows[0]) {
          // Remove pending recovery jobs (Queue.remove exists at runtime; cast to avoid TS complaining)
      const q = cartRecoveryQueue as unknown as { remove: (id: string) => Promise<void> };
      await Promise.all([
        q.remove(`cr1-${res.rows[0].id}`).catch(() => null),
        q.remove(`cr2-${res.rows[0].id}`).catch(() => null),
      ]);

      // Track conversion
      await query(
        `INSERT INTO conversions (tenant_id, cart_session_id, channel, contact_value, conversion_type, order_id, order_value)
         SELECT tenant_id, id, 'whatsapp', COALESCE(customer_phone, customer_email,'unknown'), 'purchase', $1, $2
         FROM cart_sessions WHERE id = $3
         ON CONFLICT DO NOTHING`,
        [orderId, orderValue, res.rows[0].id]
      );
    }
  }

  /** Update a session after sending recovery message */
  static async recordMessageSent(sessionId: string, sequence: number): Promise<void> {
    const col = sequence === 1 ? 'first_message_sent_at' : 'followup_sent_at';
    await query(
      `UPDATE cart_sessions SET ${col} = NOW(), updated_at = NOW() WHERE id = $1`,
      [sessionId]
    );
  }

  /** List sessions for a tenant */
  static async list(tenantId: string | null, params?: {
    status?: string; limit?: number; offset?: number;
  }): Promise<{ sessions: CartSession[]; total: number }> {
    const whereClauses: string[] = [];
    const vals: unknown[] = [];
    let i = 1;

    if (tenantId) { whereClauses.push(`tenant_id = $${i++}`); vals.push(tenantId); }
    if (params?.status) { whereClauses.push(`status = $${i++}`); vals.push(params.status); }

    const where = whereClauses.length ? `WHERE ${whereClauses.join(' AND ')}` : '';
    const limit = params?.limit ?? 50;
    const offset = params?.offset ?? 0;

    const [rows, count] = await Promise.all([
      query<CartSession>(
        `SELECT * FROM cart_sessions ${where} ORDER BY created_at DESC LIMIT $${i++} OFFSET $${i++}`,
        [...vals, limit, offset]
      ),
      query<{ count: string }>(`SELECT COUNT(*) AS count FROM cart_sessions ${where}`, vals),
    ]);

    return { sessions: rows.rows, total: parseInt(count.rows[0]?.count ?? '0') };
  }

  /** Get recovery stats for a tenant */
  static async getStats(tenantId: string | null) {
    const params = tenantId ? [tenantId] : [];
    const where = tenantId ? 'WHERE tenant_id = $1' : '';

    const res = await query<{
      total: string; abandoned: string; recovered: string;
      total_cart_value: string; total_recovered_value: string;
    }>(
      `SELECT
         COUNT(*) AS total,
         SUM(CASE WHEN status = 'abandoned' THEN 1 ELSE 0 END) AS abandoned,
         SUM(CASE WHEN status = 'recovered' THEN 1 ELSE 0 END) AS recovered,
         COALESCE(SUM(cart_value), 0) AS total_cart_value,
         COALESCE(SUM(recovery_value), 0) AS total_recovered_value
       FROM cart_sessions ${where}`,
      params
    );

    const row = res.rows[0];
    const total = parseInt(row?.total ?? '0');
    const recovered = parseInt(row?.recovered ?? '0');

    return {
      total,
      abandoned: parseInt(row?.abandoned ?? '0'),
      recovered,
      recoveryRate: total > 0 ? Math.round((recovered / total) * 100) : 0,
      totalCartValue: parseFloat(row?.total_cart_value ?? '0'),
      totalRecoveredValue: parseFloat(row?.total_recovered_value ?? '0'),
    };
  }
}

function currency(session: CartSession): string {
  return session.currency ?? 'INR';
}
