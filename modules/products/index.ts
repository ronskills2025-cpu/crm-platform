/**
 * @module products
 *
 * Product automation suite module.
 * Funnels, appointments, payment bots, reviews, events,
 * catalogs, surveys, and memberships.
 */

export { default as productDashboardRoutes } from './backend/product-dashboard.routes';
export { default as funnelRoutes } from './backend/funnel.routes';
export { default as appointmentRoutes } from './backend/appointment.routes';
export { default as paymentBotRoutes } from './backend/payment-bot.routes';
export { default as reviewRoutes } from './backend/review.routes';
export { default as eventRoutes } from './backend/event.routes';
export { default as catalogRoutes } from './backend/catalog.routes';
export { default as surveyRoutes } from './backend/survey.routes';
export { default as membershipRoutes } from './backend/membership.routes';

export const MODULE_NAME = 'products';
