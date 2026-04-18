/**
 * @module messenger
 *
 * Facebook Messenger channel module.
 * FB Graph API integration with webhook verification and HMAC validation.
 */

export { default as messengerRoutes } from './backend/messenger.routes';

export const MODULE_NAME = 'messenger';
export const API_PREFIX = '/api/messenger';
