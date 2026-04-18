/**
 * @module leads
 *
 * Lead management module.
 * CRUD, tagging, segmentation, import/export, and lead scoring.
 */

export { default as leadsRoutes } from './backend/leads.routes';

export const MODULE_NAME = 'leads';
export const API_PREFIX = '/api/leads';
