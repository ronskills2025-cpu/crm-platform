/**
 * @module email
 *
 * Email messaging channel module.
 * Multi-provider support: Resend, SendGrid, SMTP.
 */

export { default as emailRoutes } from './backend/email.routes';

export const MODULE_NAME = 'email';
export const API_PREFIX = '/api/email';
