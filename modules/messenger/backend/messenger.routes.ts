import { Router } from 'express';
import { MessengerController } from './messenger.controller';
import { channelRateLimiter } from '../../../packages/utils/src/rate-limiter';
import { authenticate } from '../../../packages/utils/src/auth.middleware';
import { verifyMetaWebhookSignature } from '../../../packages/utils/src/webhook-verify';
import { config } from '../../../packages/config/src/config';

const router = Router();

// Webhook endpoints – no auth / no rate limiter (Facebook retries on errors)
router.get('/webhook', MessengerController.verifyWebhook);
router.post('/webhook', verifyMetaWebhookSignature, MessengerController.receiveWebhook);

// Authenticated + rate-limited endpoints
router.use(authenticate);
router.use(channelRateLimiter('messenger', config.messenger.ratePerSec));

router.post('/send-batch', MessengerController.sendBatch);
router.get('/campaign/:id/stats', MessengerController.getCampaignStats);
router.get('/stats/daily', MessengerController.getDailyStats);
router.get('/stats/providers', MessengerController.getProviderStats);
router.post('/campaign/:id/retry', MessengerController.retryFailed);
router.post('/validate-page', MessengerController.validatePage);
router.post('/subscribe-app', MessengerController.subscribeApp);

export default router;
