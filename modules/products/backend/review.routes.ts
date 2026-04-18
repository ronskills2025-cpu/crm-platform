import { Router } from 'express';
import { ReviewController } from './review.controller';
import { authenticate } from '../../../packages/utils/src/auth.middleware';

const router = Router();

router.post('/', authenticate, ReviewController.create as never);
router.get('/', authenticate, ReviewController.list as never);
router.get('/stats', authenticate, ReviewController.getStats as never);
router.get('/:id', authenticate, ReviewController.getById as never);
router.post('/:id/rate', authenticate, ReviewController.submitRating as never);

export default router;
