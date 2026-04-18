import { Router } from 'express';
import { InboxController } from './inbox.controller';
import { authenticate } from '../../../packages/utils/src/auth.middleware';

const router = Router();

router.use(authenticate);

router.get('/stats', InboxController.getStats);
router.get('/threads', InboxController.listThreads);
router.post('/incoming', InboxController.receiveIncoming);
router.get('/threads/:id', InboxController.getThread);
router.post('/threads/:id/read', InboxController.markRead);
router.post('/threads/:id/assign', InboxController.assignThread);
router.post('/threads/:id/reply', InboxController.sendReply);
router.get('/threads/:id/export', InboxController.exportThread);
router.post('/messages/:messageId/retry', InboxController.retryReply);

export default router;
