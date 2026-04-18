/**
 * Catalog + Order Bot service — product catalog, cart, orders, inventory, payment links.
 */
import { query } from '../../../packages/db/src/connection';
import { ProductService } from './product.service';
import { createLogger } from '../../../packages/utils/src/logger';

const log = createLogger('service:catalog');

export interface CatalogProduct {
  id: string; tenant_id: string; product_id: string;
  name: string; description: string | null;
  price: number; currency: string; image_url: string | null;
  sku: string | null; stock_quantity: number; is_active: boolean;
  metadata: Record<string, unknown>;
  created_at: string; updated_at: string;
}

export interface CatalogOrder {
  id: string; tenant_id: string; product_id: string;
  customer_name: string | null; customer_phone: string;
  status: string; total_amount: number; currency: string;
  payment_link: string | null; payment_status: string;
  notes: string | null; metadata: Record<string, unknown>;
  created_at: string; updated_at: string;
}

export interface CatalogOrderItem {
  id: string; order_id: string; catalog_product_id: string;
  quantity: number; unit_price: number; subtotal: number;
}

export class CatalogService {
  // ── Catalog Product CRUD ──────────────────────────────────────────
  static async createProduct(tenantId: string, productId: string, data: {
    name: string; description?: string; price: number; currency?: string;
    image_url?: string; sku?: string; stock_quantity?: number;
    metadata?: Record<string, unknown>;
  }): Promise<CatalogProduct> {
    const res = await query<CatalogProduct>(
      `INSERT INTO catalog_products (tenant_id, product_id, name, description, price, currency,
         image_url, sku, stock_quantity, metadata)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb) RETURNING *`,
      [tenantId, productId, data.name, data.description ?? null,
       data.price, data.currency ?? 'INR', data.image_url ?? null,
       data.sku ?? null, data.stock_quantity ?? 0, JSON.stringify(data.metadata ?? {})]
    );
    return res.rows[0];
  }

  static async listProducts(tenantId: string, opts?: {
    activeOnly?: boolean; limit?: number; offset?: number;
  }): Promise<{ products: CatalogProduct[]; total: number }> {
    const conds = ['tenant_id = $1'];
    const params: unknown[] = [tenantId];
    if (opts?.activeOnly) conds.push('is_active = true');
    const where = conds.join(' AND ');
    params.push(opts?.limit ?? 50, opts?.offset ?? 0);
    const [rows, cnt] = await Promise.all([
      query<CatalogProduct>(`SELECT * FROM catalog_products WHERE ${where} ORDER BY created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`, params),
      query<{ count: string }>(`SELECT COUNT(*) AS count FROM catalog_products WHERE ${where}`, params.slice(0, -2)),
    ]);
    return { products: rows.rows, total: parseInt(cnt.rows[0]?.count ?? '0') };
  }

  static async getProduct(id: string): Promise<CatalogProduct | null> {
    const res = await query<CatalogProduct>('SELECT * FROM catalog_products WHERE id = $1', [id]);
    return res.rows[0] ?? null;
  }

  static async updateProduct(id: string, data: Partial<{
    name: string; description: string; price: number; currency: string;
    image_url: string; sku: string; stock_quantity: number; is_active: boolean;
  }>): Promise<CatalogProduct | null> {
    const sets: string[] = []; const params: unknown[] = [];
    for (const [k, v] of Object.entries(data)) {
      params.push(v); sets.push(`${k} = $${params.length}`);
    }
    if (!sets.length) return this.getProduct(id);
    sets.push('updated_at = NOW()');
    params.push(id);
    const res = await query<CatalogProduct>(
      `UPDATE catalog_products SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING *`, params
    );
    return res.rows[0] ?? null;
  }

  static async deleteProduct(id: string): Promise<boolean> {
    const res = await query('DELETE FROM catalog_products WHERE id = $1', [id]);
    return (res.rowCount ?? 0) > 0;
  }

  // ── Order CRUD ────────────────────────────────────────────────────
  static async createOrder(tenantId: string, productId: string, data: {
    customer_name?: string; customer_phone: string;
    items: Array<{ catalog_product_id: string; quantity: number }>;
    payment_link?: string; notes?: string;
    metadata?: Record<string, unknown>;
  }): Promise<CatalogOrder> {
    // Calculate total from items
    let totalAmount = 0;
    let currency = 'INR';
    const itemDetails: Array<{ catalog_product_id: string; quantity: number; unit_price: number; subtotal: number }> = [];

    for (const item of data.items) {
      const prod = await this.getProduct(item.catalog_product_id);
      if (!prod) continue;
      currency = prod.currency;
      const subtotal = prod.price * item.quantity;
      totalAmount += subtotal;
      itemDetails.push({
        catalog_product_id: item.catalog_product_id,
        quantity: item.quantity,
        unit_price: prod.price,
        subtotal,
      });
    }

    const res = await query<CatalogOrder>(
      `INSERT INTO catalog_orders (tenant_id, product_id, customer_name, customer_phone,
         total_amount, currency, payment_link, notes, metadata)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb) RETURNING *`,
      [tenantId, productId, data.customer_name ?? null, data.customer_phone,
       totalAmount, currency, data.payment_link ?? null,
       data.notes ?? null, JSON.stringify(data.metadata ?? {})]
    );
    const order = res.rows[0];

    // Insert order items
    for (const item of itemDetails) {
      await query(
        `INSERT INTO catalog_order_items (order_id, catalog_product_id, quantity, unit_price, subtotal)
         VALUES ($1,$2,$3,$4,$5)`,
        [order.id, item.catalog_product_id, item.quantity, item.unit_price, item.subtotal]
      );
      // Decrement stock
      await query(
        'UPDATE catalog_products SET stock_quantity = stock_quantity - $1, updated_at = NOW() WHERE id = $2 AND stock_quantity >= $1',
        [item.quantity, item.catalog_product_id]
      );
    }

    await ProductService.logEvent(tenantId, productId, 'catalog', 'order_created', order.id, 'catalog_order',
      { total: totalAmount, items: itemDetails.length });
    return order;
  }

  static async listOrders(tenantId: string, opts?: {
    status?: string; limit?: number; offset?: number;
  }): Promise<{ orders: CatalogOrder[]; total: number }> {
    const conds = ['tenant_id = $1'];
    const params: unknown[] = [tenantId];
    if (opts?.status) { params.push(opts.status); conds.push(`status = $${params.length}`); }
    const where = conds.join(' AND ');
    params.push(opts?.limit ?? 50, opts?.offset ?? 0);
    const [rows, cnt] = await Promise.all([
      query<CatalogOrder>(`SELECT * FROM catalog_orders WHERE ${where} ORDER BY created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`, params),
      query<{ count: string }>(`SELECT COUNT(*) AS count FROM catalog_orders WHERE ${where}`, params.slice(0, -2)),
    ]);
    return { orders: rows.rows, total: parseInt(cnt.rows[0]?.count ?? '0') };
  }

  static async getOrder(id: string): Promise<CatalogOrder | null> {
    const res = await query<CatalogOrder>('SELECT * FROM catalog_orders WHERE id = $1', [id]);
    return res.rows[0] ?? null;
  }

  static async getOrderItems(orderId: string): Promise<CatalogOrderItem[]> {
    const res = await query<CatalogOrderItem>(
      'SELECT * FROM catalog_order_items WHERE order_id = $1', [orderId]
    );
    return res.rows;
  }

  static async updateOrderStatus(id: string, status: string): Promise<CatalogOrder | null> {
    const res = await query<CatalogOrder>(
      'UPDATE catalog_orders SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
      [status, id]
    );
    const order = res.rows[0];
    if (order) {
      await ProductService.logEvent(order.tenant_id, order.product_id, 'catalog', 'order_status_updated',
        id, 'catalog_order', { status });
    }
    return order;
  }

  static async recordPayment(id: string, paymentStatus: string): Promise<CatalogOrder | null> {
    const orderStatus = paymentStatus === 'paid' ? 'paid' : 'pending';
    const res = await query<CatalogOrder>(
      `UPDATE catalog_orders SET payment_status = $1, status = $2, updated_at = NOW()
       WHERE id = $3 RETURNING *`,
      [paymentStatus, orderStatus, id]
    );
    const order = res.rows[0];
    if (order && paymentStatus === 'paid') {
      await ProductService.notify(order.tenant_id, 'catalog', 'payment_received',
        'Order Payment Received',
        `${order.customer_name ?? order.customer_phone} paid ${order.currency} ${order.total_amount}`,
        { entityId: id });
    }
    return order;
  }

  // ── Worker helpers ────────────────────────────────────────────────
  static async getPendingOrders(): Promise<CatalogOrder[]> {
    const res = await query<CatalogOrder>(
      `SELECT * FROM catalog_orders WHERE status = 'pending'
         AND created_at < NOW() - INTERVAL '1 hour' ORDER BY created_at`, []
    );
    return res.rows;
  }

  // ── Stats ─────────────────────────────────────────────────────────
  static async getStats(tenantId: string) {
    const res = await query<{
      total_products: string; active_products: string; total_orders: string;
      pending: string; paid: string; shipped: string; delivered: string; cancelled: string;
      revenue: string; low_stock: string;
    }>(
      `SELECT
         (SELECT COUNT(*) FROM catalog_products WHERE tenant_id = $1) AS total_products,
         (SELECT COUNT(*) FROM catalog_products WHERE tenant_id = $1 AND is_active = true) AS active_products,
         COUNT(o.id) AS total_orders,
         SUM(CASE WHEN o.status = 'pending' THEN 1 ELSE 0 END) AS pending,
         SUM(CASE WHEN o.status = 'paid' THEN 1 ELSE 0 END) AS paid,
         SUM(CASE WHEN o.status = 'shipped' THEN 1 ELSE 0 END) AS shipped,
         SUM(CASE WHEN o.status = 'delivered' THEN 1 ELSE 0 END) AS delivered,
         SUM(CASE WHEN o.status = 'cancelled' THEN 1 ELSE 0 END) AS cancelled,
         COALESCE(SUM(CASE WHEN o.payment_status = 'paid' THEN o.total_amount ELSE 0 END), 0) AS revenue,
         (SELECT COUNT(*) FROM catalog_products WHERE tenant_id = $1 AND is_active = true AND stock_quantity <= 5) AS low_stock
       FROM catalog_orders o WHERE o.tenant_id = $1`,
      [tenantId]
    );
    const r = res.rows[0];
    return {
      totalProducts: parseInt(r?.total_products ?? '0'),
      activeProducts: parseInt(r?.active_products ?? '0'),
      totalOrders: parseInt(r?.total_orders ?? '0'),
      pending: parseInt(r?.pending ?? '0'),
      paid: parseInt(r?.paid ?? '0'),
      shipped: parseInt(r?.shipped ?? '0'),
      delivered: parseInt(r?.delivered ?? '0'),
      cancelled: parseInt(r?.cancelled ?? '0'),
      revenue: parseFloat(r?.revenue ?? '0'),
      lowStock: parseInt(r?.low_stock ?? '0'),
    };
  }
}
