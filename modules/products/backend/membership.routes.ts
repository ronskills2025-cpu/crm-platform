import { Router } from 'express';
import { MembershipController } from './membership.controller';
import { authenticate } from '../../../packages/utils/src/auth.middleware';

const router = Router();

router.post('/', authenticate, MembershipController.create as never);
router.get('/', authenticate, MembershipController.list as never);
router.get('/stats', authenticate, MembershipController.getStats as never);
router.get('/:id', authenticate, MembershipController.getById as never);
router.patch('/:id', authenticate, MembershipController.update as never);
router.delete('/:id', authenticate, MembershipController.deleteMembership as never);
router.post('/:id/renew', authenticate, MembershipController.renew as never);
router.post('/:id/payment', authenticate, MembershipController.recordPayment as never);

export default router;
