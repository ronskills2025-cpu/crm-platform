/**
 * Bot Manager Routes
 * 
 * API routes for bot management.
 */

import { Router } from 'express';
import { BotController } from './bot.controller';
import { authenticate, requireRole } from '../../../packages/utils/src/auth.middleware';

const router = Router();

// All routes require authentication
router.use(authenticate);

// ══════════════════════════════════════════════════════════════════════════
// BOT CRUD
// ══════════════════════════════════════════════════════════════════════════

router.get('/', BotController.listBots);
router.post('/', BotController.createBot);
router.get('/stats', BotController.getStats);
router.get('/logs', BotController.getLogs);
router.post('/test-trigger', BotController.testTrigger);

router.get('/:id', BotController.getBot);
router.patch('/:id', BotController.updateBot);
router.delete('/:id', BotController.deleteBot);
router.post('/:id/toggle', BotController.toggleBot);

// ══════════════════════════════════════════════════════════════════════════
// TRIGGERS
// ══════════════════════════════════════════════════════════════════════════

router.get('/:botId/triggers', BotController.listTriggers);
router.post('/:botId/triggers', BotController.createTrigger);
router.delete('/:botId/triggers/:triggerId', BotController.deleteTrigger);

// ══════════════════════════════════════════════════════════════════════════
// RULES
// ══════════════════════════════════════════════════════════════════════════

router.get('/:botId/rules', BotController.listRules);
router.post('/:botId/rules', BotController.createRule);
router.delete('/:botId/rules/:ruleId', BotController.deleteRule);

// ══════════════════════════════════════════════════════════════════════════
// ACTIONS
// ══════════════════════════════════════════════════════════════════════════

router.get('/rules/:ruleId/actions', BotController.listActions);
router.post('/rules/:ruleId/actions', BotController.createAction);
router.delete('/rules/:ruleId/actions/:actionId', BotController.deleteAction);

export default router;
