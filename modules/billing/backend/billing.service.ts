import Stripe from 'stripe';
import { query } from '../../../packages/db/src/connection';
import { config } from '../../../packages/config/src/config';
import { createLogger } from '../../../packages/utils/src/logger';

const log = createLogger('service:billing');

// Lazy-initialise Stripe — only when secret key is present
let _stripe: Stripe | null = null;
function getStripe(): Stripe {
  if (!_stripe) {
    if (!config.stripe.secretKey) throw new Error('STRIPE_SECRET_KEY is not configured');
    _stripe = new Stripe(config.stripe.secretKey, { apiVersion: '2026-03-25.dahlia' });
  }
  return _stripe;
}

type PlanKey = keyof typeof config.stripe.plans;

// ── Helpers ───────────────────────────────────────────────────────────────────

function planFromPriceId(priceId: string): string {
  for (const [plan, cfg] of Object.entries(config.stripe.plans)) {
    if (cfg.priceId === priceId) return plan;
  }
  return 'starter';
}

// ── Service ───────────────────────────────────────────────────────────────────

export class BillingService {
  /** Create/get a Stripe customer for a tenant */
  static async ensureCustomer(tenantId: string, email: string, name: string): Promise<string> {
    const res = await query<{ stripe_customer_id: string | null }>(
      `SELECT stripe_customer_id FROM tenants WHERE id = $1`,
      [tenantId]
    );
    const existing = res.rows[0]?.stripe_customer_id;
    if (existing) return existing;

    const customer = await getStripe().customers.create({
      email,
      name,
      metadata: { tenantId },
    });

    await query(
      `UPDATE tenants SET stripe_customer_id = $1, updated_at = NOW() WHERE id = $2`,
      [customer.id, tenantId]
    );
    return customer.id;
  }

  /** Create a Stripe Checkout session for a plan subscription */
  static async createCheckoutSession(tenantId: string, plan: PlanKey, successUrl: string, cancelUrl: string) {
    const planConfig = config.stripe.plans[plan];
    if (!planConfig?.priceId) throw new Error(`Unknown plan: ${plan}`);

    const tenantRes = await query<{ name: string; stripe_customer_id: string | null }>(
      `SELECT name, stripe_customer_id FROM tenants WHERE id = $1`,
      [tenantId]
    );
    const tenant = tenantRes.rows[0];
    if (!tenant) throw new Error('Tenant not found');

    const session = await getStripe().checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      customer: tenant.stripe_customer_id ?? undefined,
      line_items: [{ price: planConfig.priceId, quantity: 1 }],
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: { tenantId, plan },
      subscription_data: { metadata: { tenantId, plan } },
    });

    return { url: session.url, sessionId: session.id };
  }

  /** Get current subscription for a tenant */
  static async getSubscription(tenantId: string) {
    const res = await query(
      `SELECT * FROM subscriptions WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [tenantId]
    );
    return res.rows[0] ?? null;
  }

  /** Cancel a subscription at period end */
  static async cancelSubscription(tenantId: string): Promise<void> {
    const sub = await BillingService.getSubscription(tenantId);
    if (!sub?.stripe_subscription_id) throw new Error('No active subscription found');

    await getStripe().subscriptions.update(sub.stripe_subscription_id, {
      cancel_at_period_end: true,
    });

    await query(
      `UPDATE subscriptions SET cancel_at_period_end = true, updated_at = NOW()
       WHERE tenant_id = $1 AND stripe_subscription_id = $2`,
      [tenantId, sub.stripe_subscription_id]
    );
  }

  /** Reactivate a subscription that was marked for cancellation */
  static async reactivateSubscription(tenantId: string): Promise<void> {
    const sub = await BillingService.getSubscription(tenantId);
    if (!sub?.stripe_subscription_id) throw new Error('No subscription found');

    await getStripe().subscriptions.update(sub.stripe_subscription_id, {
      cancel_at_period_end: false,
    });

    await query(
      `UPDATE subscriptions SET cancel_at_period_end = false, updated_at = NOW()
       WHERE tenant_id = $1 AND stripe_subscription_id = $2`,
      [tenantId, sub.stripe_subscription_id]
    );
  }

  /** Process Stripe webhook (raw body required for signature verification) */
  static async handleWebhook(rawBody: Buffer, signature: string): Promise<void> {
    if (!config.stripe.webhookSecret) {
      log.warn('STRIPE_WEBHOOK_SECRET not set — skipping signature verification');
      return;
    }

    let event: Stripe.Event;
    try {
      event = getStripe().webhooks.constructEvent(rawBody, signature, config.stripe.webhookSecret);
    } catch (err) {
      throw new Error(`Webhook signature verification failed: ${(err as Error).message}`);
    }

    log.info('Stripe webhook received', { type: event.type });

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.mode !== 'subscription') break;
        const tenantId = session.metadata?.tenantId;
        const plan = session.metadata?.plan ?? 'starter';
        if (!tenantId) break;

        const subId = typeof session.subscription === 'string'
          ? session.subscription
          : session.subscription?.id;
        if (!subId) break;

        const stripeSub = await getStripe().subscriptions.retrieve(subId);
        await BillingService._upsertSubscription(tenantId, stripeSub, plan);
        await query(
          `UPDATE tenants SET plan = $1, updated_at = NOW() WHERE id = $2`,
          [plan, tenantId]
        );
        break;
      }

      case 'customer.subscription.updated': {
        const stripeSub = event.data.object as Stripe.Subscription;
        const tenantId = stripeSub.metadata?.tenantId;
        if (!tenantId) break;
        const plan = planFromPriceId(stripeSub.items.data[0]?.price.id ?? '');
        await BillingService._upsertSubscription(tenantId, stripeSub, plan);
        if (stripeSub.status === 'active') {
          await query(`UPDATE tenants SET plan = $1, updated_at = NOW() WHERE id = $2`, [plan, tenantId]);
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const stripeSub = event.data.object as Stripe.Subscription;
        const tenantId = stripeSub.metadata?.tenantId;
        if (!tenantId) break;
        await query(
          `UPDATE subscriptions SET status = 'canceled', updated_at = NOW()
           WHERE stripe_subscription_id = $1`,
          [stripeSub.id]
        );
        await query(`UPDATE tenants SET plan = 'trial', updated_at = NOW() WHERE id = $1`, [tenantId]);
        break;
      }

      case 'invoice.payment_failed': {
        // Use raw object to avoid API version type drift
        const invoiceRaw = event.data.object as unknown as Record<string, unknown>;
        const subId = typeof invoiceRaw['subscription'] === 'string' ? invoiceRaw['subscription'] : null;
        if (subId) {
          await query(
            `UPDATE subscriptions SET status = 'past_due', updated_at = NOW()
             WHERE stripe_subscription_id = $1`,
            [subId]
          );
        }
        break;
      }
    }
  }

  private static async _upsertSubscription(tenantId: string, stripeSub: Stripe.Subscription, plan: string) {
    await query(
      `INSERT INTO subscriptions
         (tenant_id, stripe_subscription_id, stripe_customer_id, plan, status,
          current_period_start, current_period_end, cancel_at_period_end, amount, currency)
       VALUES ($1, $2, $3, $4, $5, to_timestamp($6), to_timestamp($7), $8, $9, $10)
       ON CONFLICT (stripe_subscription_id) DO UPDATE
         SET status = EXCLUDED.status,
             plan = EXCLUDED.plan,
             current_period_start = EXCLUDED.current_period_start,
             current_period_end = EXCLUDED.current_period_end,
             cancel_at_period_end = EXCLUDED.cancel_at_period_end,
             updated_at = NOW()`,
      [
        tenantId,
        stripeSub.id,
        typeof stripeSub.customer === 'string' ? stripeSub.customer : stripeSub.customer?.id,
        plan,
        stripeSub.status,
        stripeSub.items.data[0]?.current_period_start ?? null,
        stripeSub.items.data[0]?.current_period_end ?? null,
        stripeSub.cancel_at_period_end,
        stripeSub.items.data[0]?.price.unit_amount ?? 0,
        stripeSub.currency,
      ]
    );
  }

  /** Check if tenant can send messages (subscription is active/trialing) */
  static async canSendMessages(tenantId: string): Promise<boolean> {
    const sub = await BillingService.getSubscription(tenantId);
    if (!sub) return true; // No billing yet → allow (trial mode)
    return ['active', 'trialing'].includes(sub.status);
  }

  // ── QR Payment Configuration ─────────────────────────────────────────────────

  /** Get payment configuration for tenant */
  static async getPaymentConfig(tenantId: string): Promise<any> {
    const res = await query<{ upi_id: string; merchant_name: string; qr_code_base64: string }>(
      `SELECT upi_id, merchant_name, qr_code_base64 FROM payment_configs WHERE tenant_id = $1`,
      [tenantId]
    );
    
    if (res.rows.length === 0) {
      // Return default config if none exists
      return {
        upiId: '',
        merchantName: '',
        qrCodeBase64: null
      };
    }

    const row = res.rows[0];
    return {
      upiId: row.upi_id,
      merchantName: row.merchant_name,
      qrCodeBase64: row.qr_code_base64
    };
  }

  /** Update payment configuration for tenant */
  static async updatePaymentConfig(tenantId: string, data: { upiId: string; merchantName: string; qrCodeBase64?: string }): Promise<void> {
    await query(
      `INSERT INTO payment_configs (tenant_id, upi_id, merchant_name, qr_code_base64, created_at, updated_at)
       VALUES ($1, $2, $3, $4, NOW(), NOW())
       ON CONFLICT (tenant_id) DO UPDATE
         SET upi_id = EXCLUDED.upi_id,
             merchant_name = EXCLUDED.merchant_name,
             qr_code_base64 = COALESCE(EXCLUDED.qr_code_base64, payment_configs.qr_code_base64),
             updated_at = NOW()`,
      [tenantId, data.upiId, data.merchantName, data.qrCodeBase64 || null]
    );
  }

  /** Get QR code image for global payment (first tenant's config) */
  static async getPaymentQR(): Promise<string | null> {
    const res = await query<{ qr_code_base64: string }>(
      `SELECT qr_code_base64 FROM payment_configs WHERE qr_code_base64 IS NOT NULL LIMIT 1`
    );
    
    return res.rows[0]?.qr_code_base64 || null;
  }

  /** Create payment request record */
  static async createPaymentRequest(data: {
    tenantId: string;
    planId: string;
    planName: string;
    amount: number;
    userDetails: any;
  }): Promise<string> {
    const res = await query<{ id: string }>(
      `INSERT INTO payment_requests (tenant_id, plan_id, plan_name, amount, user_details, status, created_at)
       VALUES ($1, $2, $3, $4, $5, 'pending', NOW())
       RETURNING id`,
      [data.tenantId, data.planId, data.planName, data.amount, JSON.stringify(data.userDetails)]
    );
    
    return res.rows[0].id;
  }
}
