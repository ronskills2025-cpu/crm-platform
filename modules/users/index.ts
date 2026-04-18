/**
 * @module users
 *
 * User management module.
 * Authentication, authorization, admin panel, tenant isolation.
 */

export { default as authRoutes } from './backend/auth.routes';
export { default as adminRoutes } from './backend/admin.routes';
export { default as tenantRoutes } from './backend/tenant.routes';

export const MODULE_NAME = 'users';
