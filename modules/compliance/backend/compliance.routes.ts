/**
 * Meta Compliance Routes
 * API endpoints for opt-in management, message validation, and compliance reporting
 */

import { Router } from 'express';
import { authenticate } from '../../../packages/utils/src/auth.middleware';
import { ComplianceController } from './compliance.controller';

const router = Router();

// ═══════════════════════════════════════════════════════════════
// AUTHENTICATED ROUTES (REQUIRE TENANT AUTH)
// ═══════════════════════════════════════════════════════════════

// Opt-in Management
router.post('/opt-in', authenticate, ComplianceController.recordOptIn);
router.post('/opt-out', authenticate, ComplianceController.recordOptOut);
router.get('/opt-in-status/:phoneNumber', authenticate, ComplianceController.checkOptInStatus);

// Message Validation
router.post('/validate-message', authenticate, ComplianceController.validateMessage);

// Compliance Reporting
router.get('/report', authenticate, ComplianceController.getComplianceReport);

// ═══════════════════════════════════════════════════════════════
// PUBLIC ROUTES (NO AUTH REQUIRED)
// ═══════════════════════════════════════════════════════════════

// Public opt-in (for websites, QR codes, etc.)
router.post('/public/opt-in/:tenantId', ComplianceController.publicOptIn);

// Public opt-out (for unsubscribe links)
router.post('/public/opt-out/:tenantId', ComplianceController.publicOptOut);

export { router as complianceRoutes };
