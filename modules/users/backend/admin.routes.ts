import { Router } from 'express';
import { AdminController } from './admin.controller';
import { authenticate, requireRole } from '../../../packages/utils/src/auth.middleware';

const router = Router();

// All admin routes require authentication + admin/superadmin role
router.use(authenticate);
router.use(requireRole('admin', 'superadmin'));

// ── Provider CRUD ─────────────────────────────────────────────────
router.get('/providers', AdminController.listProviders);
router.get('/providers/health', AdminController.providerHealth);
router.get('/providers/:id', AdminController.getProvider);
router.post('/providers', AdminController.createProvider);
router.patch('/providers/:id', AdminController.updateProvider);
router.delete('/providers/:id', AdminController.deleteProvider);
router.post('/providers/reorder', AdminController.reorderProviders);

// ── Provider actions ──────────────────────────────────────────────
router.post('/providers/:id/validate', AdminController.validateProvider);
router.post('/providers/:id/pause', AdminController.pauseProvider);
router.post('/providers/:id/resume', AdminController.resumeProvider);
router.post('/providers/:id/test', AdminController.testProvider);

// ── WhatsApp webhook ──────────────────────────────────────────────
router.post('/providers/:id/webhook/register', AdminController.registerWebhook);
router.get('/webhook/verify', AdminController.verifyWebhookChallenge);

// ── Campaign errors & retry ───────────────────────────────────────
router.get('/campaign-errors', AdminController.getCampaignErrors);
router.post('/campaigns/:campaignId/retry', AdminController.retryFailedMessages);

// ── System overview ─────────────────────────────────────────
router.get('/system-overview', AdminController.systemOverview);
router.get('/unified-dashboard', AdminController.unifiedDashboard);

// ── User management ────────────────────────────────────────
router.get('/users', AdminController.listAllUsers);
router.post('/users/invite', AdminController.inviteUser);
router.patch('/users/:id', AdminController.updateUserRole);
router.delete('/users/:id', AdminController.deleteUser);

export default router;
