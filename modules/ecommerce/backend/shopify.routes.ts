import express, { Router } from 'express';
import { ShopifyController } from './shopify.controller';
import { authenticate, optionalAuth } from '../../../packages/utils/src/auth.middleware';

const router = Router();

// Shopify webhook — raw body, no JSON parsing
router.post(
  '/webhook',
  express.raw({ type: ['application/json', 'text/plain'] }),
  ShopifyController.webhook
);

// Cart recovery sessions (authenticated)
router.get('/sessions', authenticate, ShopifyController.listSessions);
router.get('/stats', optionalAuth, ShopifyController.getStats);
router.post('/sessions/:cartToken/recover', authenticate, ShopifyController.markRecovered);

// Conversion tracking
router.get('/conversions', authenticate, ShopifyController.listConversions);
router.get('/conversions/stats', authenticate, ShopifyController.getConversionStats);

export default router;
