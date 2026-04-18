import { Router } from 'express';
import { CampaignController } from './campaign.controller';
import { authenticate } from '../../../packages/utils/src/auth.middleware';

const router = Router();

router.use(authenticate);

router.post('/', CampaignController.create);
router.get('/', CampaignController.list);
router.get('/stats', CampaignController.getGlobalStats);
router.get('/failed', CampaignController.getFailedMessages);
router.get('/:id', CampaignController.getById);
router.patch('/:id/status', CampaignController.updateStatus);
router.post('/:id/pause', CampaignController.pause);
router.post('/:id/resume', CampaignController.resume);

export default router;
