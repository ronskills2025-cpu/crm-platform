import { Router } from 'express';
import { AutomationController } from './automation.controller';
import { authenticate } from '../../../packages/utils/src/auth.middleware';

const router = Router();

router.use(authenticate);

// Rules
router.get('/rules', AutomationController.listRules);
router.post('/rules', AutomationController.createRule);
router.get('/rules/logs', AutomationController.getLogs);
router.get('/rules/:id', AutomationController.getRule);
router.put('/rules/:id', AutomationController.updateRule);
router.delete('/rules/:id', AutomationController.deleteRule);
router.patch('/rules/:id/toggle', AutomationController.toggleRule);

// Scheduled campaigns
router.get('/scheduled', AutomationController.listScheduled);
router.post('/scheduled', AutomationController.createScheduled);
router.put('/scheduled/:id', AutomationController.updateScheduled);
router.patch('/scheduled/:id/cancel', AutomationController.cancelScheduled);
router.delete('/scheduled/:id', AutomationController.deleteScheduled);

export default router;
