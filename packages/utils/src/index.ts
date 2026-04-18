/**
 * @packages/utils — Shared utilities
 *
 * Logger, failover, middleware, queue factories — used across all modules.
 */

export { createLogger } from './logger';
export { executeWithFailover } from './failover';
export type { FailoverResult } from './failover';
export { authenticate, optionalAuth, requireRole } from './auth.middleware';
export type { AuthRequest } from './auth.middleware';
export { rateLimiter } from './rate-limiter';
