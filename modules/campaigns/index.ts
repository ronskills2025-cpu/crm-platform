/**
 * @module campaigns
 *
 * Campaign management module.
 * Campaign builder, scheduling, templates, multi-channel dispatch.
 */

export { default as campaignRoutes } from './backend/campaign.routes';
export { default as templateRoutes } from './backend/template.routes';

export const MODULE_NAME = 'campaigns';
export const API_PREFIX = '/api/campaigns';
