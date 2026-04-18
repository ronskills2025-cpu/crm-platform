import { Router } from 'express';
import { TenantController } from './tenant.controller';
import { authenticate, requireRole } from '../../../packages/utils/src/auth.middleware';

const router = Router();

// All tenant routes require auth
router.use(authenticate);

// Tenant CRUD (superadmin only for list/create/delete)
router.post('/', requireRole('superadmin'), TenantController.create);
router.get('/', requireRole('superadmin'), TenantController.list);
router.get('/:id', TenantController.getById);
router.patch('/:id', TenantController.update);
router.delete('/:id', requireRole('superadmin'), TenantController.delete);
router.get('/:id/stats', TenantController.getStats);

// Phone numbers per tenant
router.get('/:tenantId/numbers', TenantController.listNumbers);
router.post('/:tenantId/numbers', requireRole('admin', 'superadmin'), TenantController.addNumber);
router.delete('/:tenantId/numbers/:numberId', requireRole('admin', 'superadmin'), TenantController.removeNumber);

// Shortcut: my tenant's numbers (uses tenantId from JWT)
router.get('/my/numbers', TenantController.listNumbers);
router.post('/my/numbers', requireRole('admin', 'superadmin'), TenantController.addNumber);
router.delete('/my/numbers/:numberId', requireRole('admin', 'superadmin'), TenantController.removeNumber);

export default router;
