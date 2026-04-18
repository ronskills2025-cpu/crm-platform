import { Router } from 'express';
import { EmailController } from './email.controller';
import { channelRateLimiter } from '../../../packages/utils/src/rate-limiter';
import { authenticate } from '../../../packages/utils/src/auth.middleware';
import { config } from '../../../packages/config/src/config';

const router = Router();

// Inbound webhooks – no rate limiter
router.post('/webhook/inbound', EmailController.receiveInboundWebhook);
router.post('/webhook/status', EmailController.receiveStatusWebhook);

router.use(authenticate);
router.use(channelRateLimiter('email', config.email.ratePerSec));

router.post('/send-batch', EmailController.sendBatch);
router.get('/campaign/:id/stats', EmailController.getCampaignStats);
router.get('/stats/daily', EmailController.getDailyStats);
router.get('/stats/providers', EmailController.getProviderStats);
router.post('/campaign/:id/retry', EmailController.retryFailed);
router.get('/track/open/:id', EmailController.trackOpen);
router.get('/track/click/:id', EmailController.trackClick);

export default router;
