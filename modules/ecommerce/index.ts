/**
 * @module ecommerce
 *
 * E-commerce integration module.
 * Shopify webhooks and cart recovery automation.
 */

export { default as shopifyRoutes } from './backend/shopify.routes';

export const MODULE_NAME = 'ecommerce';
export const API_PREFIX = '/api/shopify';
