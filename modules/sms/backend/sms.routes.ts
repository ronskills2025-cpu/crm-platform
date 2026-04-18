import { Router } from 'express';
import { SMSController } from './sms.controller';
import { SMSEnterpriseController } from './sms-enterprise.controller';
import { channelRateLimiter } from '../../../packages/utils/src/rate-limiter';
import { authenticate } from '../../../packages/utils/src/auth.middleware';
import { config } from '../../../packages/config/src/config';

const router = Router();

// Inbound webhooks – no rate limiter
router.post('/webhook/inbound', SMSController.receiveInboundWebhook);
router.post('/webhook/status', SMSController.receiveStatusWebhook);

router.use(authenticate);
router.use(channelRateLimiter('sms', config.sms.ratePerSec));

// ── Existing Endpoints ──────────────────────────────────────────
router.post('/send-batch', SMSController.sendBatch);
router.get('/campaign/:id/stats', SMSController.getCampaignStats);
router.get('/stats/daily', SMSController.getDailyStats);
router.get('/stats/providers', SMSController.getProviderStats);
router.post('/campaign/:id/retry', SMSController.retryFailed);

// ── DLT Entities ────────────────────────────────────────────────
router.get('/dlt/entities', SMSEnterpriseController.listDLTEntities);
router.post('/dlt/entities', SMSEnterpriseController.createDLTEntity);
router.put('/dlt/entities/:id', SMSEnterpriseController.updateDLTEntity);
router.delete('/dlt/entities/:id', SMSEnterpriseController.deleteDLTEntity);

// ── DLT Templates ───────────────────────────────────────────────
router.get('/dlt/templates', SMSEnterpriseController.listDLTTemplates);
router.post('/dlt/templates', SMSEnterpriseController.createDLTTemplate);
router.put('/dlt/templates/:id', SMSEnterpriseController.updateDLTTemplate);
router.delete('/dlt/templates/:id', SMSEnterpriseController.deleteDLTTemplate);
router.post('/dlt/validate', SMSEnterpriseController.validateDLTMessage);

// ── Sender IDs ──────────────────────────────────────────────────
router.get('/sender-ids', SMSEnterpriseController.listSenderIds);
router.post('/sender-ids', SMSEnterpriseController.createSenderId);
router.put('/sender-ids/:id', SMSEnterpriseController.updateSenderId);
router.delete('/sender-ids/:id', SMSEnterpriseController.deleteSenderId);

// ── Virtual Numbers ─────────────────────────────────────────────
router.get('/virtual-numbers', SMSEnterpriseController.listVirtualNumbers);
router.post('/virtual-numbers', SMSEnterpriseController.createVirtualNumber);
router.put('/virtual-numbers/:id', SMSEnterpriseController.updateVirtualNumber);
router.delete('/virtual-numbers/:id', SMSEnterpriseController.deleteVirtualNumber);

// ── Region Routes ───────────────────────────────────────────────
router.get('/region-routes', SMSEnterpriseController.listRegionRoutes);
router.post('/region-routes', SMSEnterpriseController.upsertRegionRoute);
router.delete('/region-routes/:id', SMSEnterpriseController.deleteRegionRoute);

// ── Analytics ───────────────────────────────────────────────────
router.get('/analytics/hourly', SMSEnterpriseController.getHourlyAnalytics);
router.get('/analytics/campaign/:id', SMSEnterpriseController.getCampaignAnalytics);
router.get('/analytics/providers', SMSEnterpriseController.getProviderComparison);
router.get('/analytics/regions', SMSEnterpriseController.getRegionalStats);
router.get('/analytics/cost', SMSEnterpriseController.getCostOverview);
router.post('/analytics/materialize', SMSEnterpriseController.materializeAnalytics);

// ── Scheduling ──────────────────────────────────────────────────
router.get('/scheduled-jobs', SMSEnterpriseController.listScheduledJobs);
router.post('/scheduled-jobs', SMSEnterpriseController.createScheduledJob);
router.post('/scheduled-jobs/:id/cancel', SMSEnterpriseController.cancelScheduledJob);
router.delete('/scheduled-jobs/:id', SMSEnterpriseController.deleteScheduledJob);

export default router;
