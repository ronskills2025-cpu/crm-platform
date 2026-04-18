/**
 * @module billing
 *
 * Billing and subscription module.
 * Stripe integration, plan management, usage tracking.
 */

export { default as billingRoutes } from './backend/billing.routes';

export const MODULE_NAME = 'billing';
export const API_PREFIX = '/api/billing';
