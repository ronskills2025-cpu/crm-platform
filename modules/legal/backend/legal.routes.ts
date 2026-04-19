/**
 * Legal Pages Routes
 * Serves privacy policy, terms of service, and other legal documents
 * CRITICAL FOR META VERIFICATION
 */

import { Router } from 'express';
import { LegalController } from './legal.controller';

const router = Router();

// Legal pages (no authentication required - public access)
router.get('/privacy-policy', LegalController.privacyPolicy);
router.get('/terms-of-service', LegalController.termsOfService);
router.get('/acceptable-use-policy', LegalController.acceptableUsePolicy);
router.get('/data-processing-agreement', LegalController.dataProcessingAgreement);

// Aliases for common variations
router.get('/privacy', LegalController.privacyPolicy);
router.get('/terms', LegalController.termsOfService);
router.get('/aup', LegalController.acceptableUsePolicy);
router.get('/dpa', LegalController.dataProcessingAgreement);

export { router as legalRoutes };
