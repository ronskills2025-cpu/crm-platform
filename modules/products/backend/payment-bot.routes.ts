import { Router } from 'express';
import { PaymentBotController } from './payment-bot.controller';
import { authenticate } from '../../../packages/utils/src/auth.middleware';

const router = Router();

router.post('/', authenticate, PaymentBotController.create as never);
router.get('/', authenticate, PaymentBotController.list as never);
router.get('/stats', authenticate, PaymentBotController.getStats as never);
router.get('/:id', authenticate, PaymentBotController.getById as never);
router.post('/:id/payment', authenticate, PaymentBotController.recordPayment as never);
router.post('/:id/escalate', authenticate, PaymentBotController.escalate as never);

export default router;
