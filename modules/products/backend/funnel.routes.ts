import { Router } from 'express';
import { FunnelController } from './funnel.controller';
import { authenticate } from '../../../packages/utils/src/auth.middleware';
import { verifyMetaWebhookSignature } from '../../../packages/utils/src/webhook-verify';

const router = Router();

// Public Meta Ads webhook with signature verification
router.post('/webhook/meta', verifyMetaWebhookSignature, FunnelController.metaWebhook as never);

// Authenticated routes
router.post('/leads', authenticate, FunnelController.captureLead as never);
router.get('/leads', authenticate, FunnelController.listLeads as never);
router.get('/leads/:id', authenticate, FunnelController.getLead as never);
router.patch('/leads/:id', authenticate, FunnelController.updateLead as never);
router.post('/leads/:id/click', authenticate, FunnelController.recordClick as never);
router.post('/leads/:id/reply', authenticate, FunnelController.recordReply as never);

// Steps
router.get('/products/:productId/steps', authenticate, FunnelController.listSteps as never);
router.put('/products/:productId/steps', authenticate, FunnelController.upsertStep as never);
router.delete('/products/:productId/steps/:stepNumber', authenticate, FunnelController.deleteStep as never);

// Stats
router.get('/stats', authenticate, FunnelController.getStats as never);

export default router;
