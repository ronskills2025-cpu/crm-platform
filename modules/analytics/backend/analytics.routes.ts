import { Router } from 'express';
import { authenticate } from '../../../packages/utils/src/auth.middleware';
import { AnalyticsController } from './analytics.controller';

const router = Router();

router.use(authenticate);

router.get('/dashboard',  AnalyticsController.dashboard);
router.get('/summary',    AnalyticsController.summary);
router.get('/leads',      AnalyticsController.leads);
router.get('/campaigns',  AnalyticsController.campaigns);
router.get('/channels',   AnalyticsController.channels);
router.get('/revenue',    AnalyticsController.revenue);
router.get('/automation', AnalyticsController.automation);

export default router;
