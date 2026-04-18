import { Router } from 'express';
import { AuthController } from './auth.controller';
import { authenticate, requireRole } from '../../../packages/utils/src/auth.middleware';
import { rateLimiter } from '../../../packages/utils/src/rate-limiter';

const router = Router();

// Strict rate limiting on auth endpoints to prevent brute force
router.post('/register', rateLimiter(5, 300), AuthController.register);
router.post('/login', rateLimiter(10, 300), AuthController.login);
router.get('/me', authenticate, AuthController.me);
router.patch('/me/password', authenticate, AuthController.changePassword);
router.get('/users', authenticate, AuthController.listUsers);
router.post('/users/invite', authenticate, requireRole('admin', 'superadmin'), AuthController.inviteUser);

export default router;
