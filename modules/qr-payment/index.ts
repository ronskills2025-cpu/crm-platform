/**
 * @module qr-payment
 *
 * QR Payment system module.
 * QR code checkout, payment status tracking, admin management.
 */

export { default as qrPaymentRoutes } from './backend/qr-payment.routes';

export const MODULE_NAME = 'qr-payment';
export const API_PREFIX = '/api/qr-payment';
