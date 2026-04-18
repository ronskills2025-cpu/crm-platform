import { Router } from 'express';
import { TelegramController } from './telegram.controller';
import { channelRateLimiter } from '../../../packages/utils/src/rate-limiter';
import { authenticate } from '../../../packages/utils/src/auth.middleware';
import { config } from '../../../packages/config/src/config';

const router = Router();

// Webhook endpoint – no rate limiter (Telegram retries on 5xx)
router.post('/webhook', TelegramController.receiveWebhook);

router.use(authenticate);
router.use(channelRateLimiter('telegram', config.telegram.ratePerSec));

router.post('/send-batch', TelegramController.sendBatch);
router.get('/campaign/:id/stats', TelegramController.getCampaignStats);
router.get('/stats/daily', TelegramController.getDailyStats);
router.get('/stats/providers', TelegramController.getProviderStats);
router.post('/campaign/:id/retry', TelegramController.retryFailed);
router.post('/validate-bot', TelegramController.validateBot);
router.post('/setup-webhook', TelegramController.setupWebhook);

export default router;
