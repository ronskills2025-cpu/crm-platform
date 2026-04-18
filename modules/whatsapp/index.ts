/**
 * @module whatsapp
 *
 * WhatsApp messaging channel module.
 * Handles sending/receiving WhatsApp messages, webhooks, batching, and inbox.
 *
 * Backend: controller, service, routes, worker, model
 * Frontend: Dashboard, Inbox pages
 */

// ── Backend exports ──
export { default as whatsappRoutes } from './backend/whatsapp.routes';

// ── Module metadata ──
export const MODULE_NAME = 'whatsapp';
export const API_PREFIX = '/api/whatsapp';
