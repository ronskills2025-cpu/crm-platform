import { Router } from 'express';
import { ProductDashboardController } from './product-dashboard.controller';
import { authenticate } from '../../../packages/utils/src/auth.middleware';

const router = Router();

// Product registry
router.post('/', authenticate, ProductDashboardController.register as never);
router.get('/', authenticate, ProductDashboardController.listProducts as never);
router.patch('/:id/toggle', authenticate, ProductDashboardController.toggleProduct as never);
router.delete('/:id', authenticate, ProductDashboardController.deleteProduct as never);

// Config
router.put('/:id/config', authenticate, ProductDashboardController.setConfig as never);
router.get('/:id/config', authenticate, ProductDashboardController.getConfig as never);

// Events + Notifications
router.get('/events', authenticate, ProductDashboardController.listEvents as never);
router.get('/notifications', authenticate, ProductDashboardController.listNotifications as never);
router.post('/notifications/read', authenticate, ProductDashboardController.markNotificationsRead as never);

// Dashboard
router.get('/dashboard/stats', authenticate, ProductDashboardController.getDashboardStats as never);

export default router;
