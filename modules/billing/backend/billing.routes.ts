import express, { Router } from 'express';
import { BillingController } from './billing.controller';
import { authenticate } from '../../../packages/utils/src/auth.middleware';

const router = Router();

// Public: plan catalogue (no auth needed)
router.get('/plans', BillingController.getPlans);

// Stripe webhook — raw body required, no JSON parsing
router.post(
  '/webhook',
  express.raw({ type: 'application/json' }),
  BillingController.stripeWebhook
);

// Protected billing routes
router.get('/subscription', authenticate, BillingController.getSubscription);
router.post('/checkout', authenticate, BillingController.createCheckout);
router.post('/subscription/cancel', authenticate, BillingController.cancelSubscription);
router.post('/subscription/reactivate', authenticate, BillingController.reactivateSubscription);

// Admin QR Payment Configuration
router.get('/admin/payment-config', authenticate, BillingController.getPaymentConfig);
router.post('/admin/payment-config', authenticate, BillingController.updatePaymentConfig);
router.get('/admin/payment-qr', BillingController.getPaymentQR);

export default router;
