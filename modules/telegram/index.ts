/**
 * @module telegram
 *
 * Telegram messaging channel module.
 * Bot-based messaging with webhook support and failover.
 */

export { default as telegramRoutes } from './backend/telegram.routes';

export const MODULE_NAME = 'telegram';
export const API_PREFIX = '/api/telegram';
