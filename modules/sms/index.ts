/**
 * @module sms
 *
 * SMS messaging channel module.
 * Includes enterprise SMS features: DLT, sender IDs, routing, analytics,
 * scheduling, virtual numbers, and multi-provider support.
 *
 * Backend: controllers, services, routes, worker, model, migration
 * Frontend: Dashboard, Inbox, Provider Settings, Analytics pages
 */

export { default as smsRoutes } from './backend/sms.routes';

export const MODULE_NAME = 'sms';
export const API_PREFIX = '/api/sms';
