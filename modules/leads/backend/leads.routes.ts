import { Router } from 'express';
import { LeadsController } from './leads.controller';
import { authenticate } from '../../../packages/utils/src/auth.middleware';

const router = Router();

router.use(authenticate);

router.get('/', LeadsController.list);
router.post('/', LeadsController.create);
router.get('/stats', LeadsController.stats);
router.get('/dashboard', LeadsController.dashboard);
router.get('/analytics', LeadsController.analytics);
router.get('/:id', LeadsController.get);
router.get('/:id/conversations', LeadsController.getConversations);
router.put('/:id', LeadsController.update);
router.patch('/:id/tags', LeadsController.tag);
router.patch('/:id/segment', LeadsController.setSegment);
router.patch('/:id/status', LeadsController.setStatus);
router.delete('/:id', LeadsController.remove);

export default router;
