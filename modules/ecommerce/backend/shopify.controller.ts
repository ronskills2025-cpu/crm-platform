import { Request, Response } from 'express';
import { CartRecoveryService, verifyShopifyWebhook } from '../../../modules/wa-saas/backend/cart-recovery.service';
import { ConversionService } from '../../../modules/wa-saas/backend/conversion.service';
import { query } from '../../../packages/db/src/connection';
import { z } from 'zod';
import { createLogger } from '../../../packages/utils/src/logger';
import type { AuthRequest } from '../../../packages/utils/src/auth.middleware';

const log = createLogger('ctrl:shopify');

const OrderWebhookSchema = z.object({
  id: z.union([z.string(), z.number()]),
  cart_token: z.string().optional(),
  total_price: z.string().optional(),
  checkout_token: z.string().optional(),
});

const ManualRecoverySchema = z.object({
  cartToken: z.string(),
  orderId: z.string(),
  orderValue: z.number().nonnegative(),
});

export class ShopifyController {
  /** POST /api/shopify/webhook — raw body, HMAC-verified */
  static async webhook(req: Request, res: Response) {
    try {
      const rawBody = req.body as Buffer;
      const hmac = req.headers['x-shopify-hmac-sha256'] as string;
      const topic = req.headers['x-shopify-topic'] as string;
      const shopDomain = (req.headers['x-shopify-shop-domain'] as string) ?? 'unknown';

      if (hmac && !verifyShopifyWebhook(rawBody, hmac)) {
        res.status(401).json({ error: 'Invalid webhook signature' }); return;
      }

      // Log the event
      const payload = JSON.parse(rawBody.toString('utf8')) as Record<string, unknown>;
      await query(
        `INSERT INTO webhook_events (source, event_type, payload, processed)
         VALUES ('shopify', $1, $2, false)`,
        [topic ?? 'unknown', JSON.stringify(payload)]
      ).catch(() => null);

      // Get tenant from shop domain mapping
      const tenantRes = await query<{ tenant_id: string }>(
        `SELECT tenant_id FROM cart_sessions WHERE shop_domain = $1 LIMIT 1`,
        [shopDomain]
      ).catch(() => ({ rows: [] as Array<{ tenant_id: string }> }));
      const tenantId = tenantRes.rows[0]?.tenant_id ?? null;

      if (topic === 'carts/update' || topic === 'checkouts/create') {
        await CartRecoveryService.handleAbandoned(tenantId, payload as never, shopDomain);
      } else if (topic === 'orders/create' || topic === 'orders/paid') {
        const order = OrderWebhookSchema.safeParse(payload);
        if (order.success && order.data.cart_token) {
          await CartRecoveryService.markRecovered(
            tenantId,
            order.data.cart_token,
            String(order.data.id),
            parseFloat(order.data.total_price ?? '0')
          );
        }
      }

      // Mark event as processed
      await query(
        `UPDATE webhook_events SET processed = true, processed_at = NOW()
         WHERE source = 'shopify' AND event_type = $1 AND processed = false
         ORDER BY created_at DESC LIMIT 1`,
        [topic ?? 'unknown']
      ).catch(() => null);

      res.status(200).json({ ok: true });
    } catch (err) {
      log.error('Shopify webhook error', err);
      res.status(500).json({ error: 'Webhook processing failed' });
    }
  }

  /** GET /api/shopify/sessions — list cart sessions */
  static async listSessions(req: AuthRequest, res: Response) {
    try {
      const result = await CartRecoveryService.list(req.tenantId ?? null, {
        status: req.query.status as string,
        limit: parseInt(req.query.limit as string) || 50,
        offset: parseInt(req.query.offset as string) || 0,
      });
      res.json({ success: true, ...result });
    } catch (err) {
      log.error('listSessions failed', err);
      res.status(500).json({ error: 'Failed to list sessions' });
    }
  }

  /** GET /api/shopify/stats */
  static async getStats(req: AuthRequest, res: Response) {
    try {
      const stats = await CartRecoveryService.getStats(req.tenantId ?? null);
      res.json({ success: true, stats });
    } catch (err) {
      log.error('getStats failed', err);
      res.status(500).json({ error: 'Failed to get stats' });
    }
  }

  /** POST /api/shopify/sessions/:cartToken/recover — manual recovery mark */
  static async markRecovered(req: AuthRequest, res: Response) {
    try {
      const { cartToken, orderId, orderValue } = ManualRecoverySchema.parse({ cartToken: req.params.cartToken, ...req.body });
      await CartRecoveryService.markRecovered(req.tenantId ?? null, cartToken, orderId, orderValue);
      res.json({ success: true });
    } catch (err) {
      if (err instanceof z.ZodError) { res.status(400).json({ error: 'Validation failed', details: err.errors }); return; }
      log.error('markRecovered failed', err);
      res.status(500).json({ error: 'Failed to mark as recovered' });
    }
  }

  /** GET /api/shopify/conversions */
  static async listConversions(req: AuthRequest, res: Response) {
    try {
      const result = await ConversionService.list(req.tenantId ?? null, {
        channel: req.query.channel as string,
        campaignId: req.query.campaignId as string,
        limit: parseInt(req.query.limit as string) || 50,
        offset: parseInt(req.query.offset as string) || 0,
      });
      res.json({ success: true, ...result });
    } catch (err) {
      log.error('listConversions failed', err);
      res.status(500).json({ error: 'Failed to list conversions' });
    }
  }

  /** GET /api/shopify/conversions/stats */
  static async getConversionStats(req: AuthRequest, res: Response) {
    try {
      const stats = await ConversionService.getStats(req.tenantId ?? null, parseInt(req.query.days as string) || 30);
      res.json({ success: true, stats });
    } catch (err) {
      log.error('getConversionStats failed', err);
      res.status(500).json({ error: 'Failed to get conversion stats' });
    }
  }
}
