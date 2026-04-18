import { Response, Request } from 'express';
import { BillingService } from './billing.service';
import { z } from 'zod';
import { createLogger } from '../../../packages/utils/src/logger';
import { config } from '../../../packages/config/src/config';
import type { AuthRequest } from '../../../packages/utils/src/auth.middleware';

const log = createLogger('ctrl:billing');

const CheckoutSchema = z.object({
  plan: z.enum(['starter', 'pro', 'enterprise']),
  successUrl: z.string().url(),
  cancelUrl: z.string().url(),
});

export class BillingController {
  static async getSubscription(req: AuthRequest, res: Response) {
    try {
      const sub = await BillingService.getSubscription(req.tenantId!);
      res.json({ success: true, subscription: sub });
    } catch (err) {
      log.error('getSubscription failed', err);
      res.status(500).json({ error: 'Failed to get subscription' });
    }
  }

  static async createCheckout(req: AuthRequest, res: Response) {
    try {
      if (!config.stripe.secretKey) {
        res.status(503).json({ error: 'Billing not configured' }); return;
      }
      const { plan, successUrl, cancelUrl } = CheckoutSchema.parse(req.body);
      const session = await BillingService.createCheckoutSession(req.tenantId!, plan, successUrl, cancelUrl);
      res.json({ success: true, ...session });
    } catch (err) {
      if (err instanceof z.ZodError) { res.status(400).json({ error: 'Validation failed', details: err.errors }); return; }
      log.error('createCheckout failed', err);
      res.status(500).json({ error: 'Failed to create checkout session' });
    }
  }

  static async cancelSubscription(req: AuthRequest, res: Response) {
    try {
      await BillingService.cancelSubscription(req.tenantId!);
      res.json({ success: true, message: 'Subscription will be cancelled at period end' });
    } catch (err) {
      if ((err as Error).message?.includes('No active')) { res.status(404).json({ error: (err as Error).message }); return; }
      log.error('cancelSubscription failed', err);
      res.status(500).json({ error: 'Failed to cancel subscription' });
    }
  }

  static async reactivateSubscription(req: AuthRequest, res: Response) {
    try {
      await BillingService.reactivateSubscription(req.tenantId!);
      res.json({ success: true });
    } catch (err) {
      log.error('reactivateSubscription failed', err);
      res.status(500).json({ error: 'Failed to reactivate subscription' });
    }
  }

  /** Raw body webhook handler — must be registered BEFORE express.json() parses it */
  static async stripeWebhook(req: Request, res: Response) {
    try {
      const sig = req.headers['stripe-signature'] as string;
      if (!sig) { res.status(400).json({ error: 'Missing Stripe-Signature header' }); return; }
      await BillingService.handleWebhook(req.body as Buffer, sig);
      res.json({ received: true });
    } catch (err) {
      log.error('Stripe webhook failed', err);
      res.status(400).json({ error: (err as Error).message });
    }
  }

  static async getPlans(_req: Request, res: Response) {
    const plans = [
      {
        id: 'starter',
        name: 'Starter',
        price: 999,
        currency: 'INR',
        interval: 'month',
        maxNumbers: config.stripe.plans.starter.maxNumbers,
        maxMessages: config.stripe.plans.starter.maxMessages,
        features: ['Up to 10 WhatsApp numbers', '10,000 messages/month', 'Cart recovery', 'Basic analytics'],
      },
      {
        id: 'pro',
        name: 'Pro',
        price: 2999,
        currency: 'INR',
        interval: 'month',
        maxNumbers: config.stripe.plans.pro.maxNumbers,
        maxMessages: config.stripe.plans.pro.maxMessages,
        features: ['Up to 50 WhatsApp numbers', '100,000 messages/month', 'Advanced automation', 'Full analytics', 'Priority support'],
      },
      {
        id: 'enterprise',
        name: 'Enterprise',
        price: 9999,
        currency: 'INR',
        interval: 'month',
        maxNumbers: config.stripe.plans.enterprise.maxNumbers,
        maxMessages: config.stripe.plans.enterprise.maxMessages,
        features: ['Unlimited numbers', '1M messages/month', 'White-label', 'Custom domain', 'Dedicated support'],
      },
    ];
    res.json({ success: true, plans });
  }

  // Admin QR Payment Configuration
  static async getPaymentConfig(req: AuthRequest, res: Response) {
    try {
      const config = await BillingService.getPaymentConfig(req.tenantId!);
      res.json({ success: true, config });
    } catch (err) {
      log.error('getPaymentConfig failed', err);
      res.status(500).json({ error: 'Failed to get payment config' });
    }
  }

  static async updatePaymentConfig(req: AuthRequest, res: Response) {
    try {
      const PaymentConfigSchema = z.object({
        upiId: z.string().min(1),
        merchantName: z.string().min(1),
        qrCodeBase64: z.string().optional()
      });

      const data = PaymentConfigSchema.parse(req.body);
      await BillingService.updatePaymentConfig(req.tenantId!, data);
      res.json({ success: true, message: 'Payment configuration updated' });
    } catch (err) {
      if (err instanceof z.ZodError) { 
        res.status(400).json({ error: 'Validation failed', details: err.errors }); 
        return; 
      }
      log.error('updatePaymentConfig failed', err);
      res.status(500).json({ error: 'Failed to update payment config' });
    }
  }

  static async getPaymentQR(req: Request, res: Response) {
    try {
      const qrImage = await BillingService.getPaymentQR();
      if (!qrImage) {
        res.status(404).json({ error: 'QR code not configured' });
        return;
      }
      
      // Return QR code as image
      const buffer = Buffer.from(qrImage, 'base64');
      res.setHeader('Content-Type', 'image/png');
      res.setHeader('Cache-Control', 'public, max-age=3600');
      res.send(buffer);
    } catch (err) {
      log.error('getPaymentQR failed', err);
      res.status(500).json({ error: 'Failed to get QR code' });
    }
  }
}
