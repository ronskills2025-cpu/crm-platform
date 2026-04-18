import { Router } from 'express';
import { WhatsAppController } from './whatsapp.controller';
import { channelRateLimiter } from '../../../packages/utils/src/rate-limiter';
import { authenticate } from '../../../packages/utils/src/auth.middleware';
import { config } from '../../../packages/config/src/config';

const router = Router();

// Webhook endpoints – no rate limiter (Meta retries on 5xx)
router.get('/webhook', WhatsAppController.verifyWebhook);
router.post('/webhook', WhatsAppController.receiveWebhook);

router.use(authenticate);
router.use(channelRateLimiter('whatsapp', config.whatsapp.ratePerSec));

router.post('/send-batch', WhatsAppController.sendBatch);
router.get('/campaign/:id/stats', WhatsAppController.getCampaignStats);
router.get('/stats/daily', WhatsAppController.getDailyStats);
router.get('/stats/providers', WhatsAppController.getProviderStats);
router.post('/campaign/:id/retry', WhatsAppController.retryFailed);

export default router;
