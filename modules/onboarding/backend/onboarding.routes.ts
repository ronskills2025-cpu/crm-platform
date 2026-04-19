/**
 * Onboarding Routes
 * WhatsApp Business API Setup and User Guidance
 */

import { Router } from 'express';
import { OnboardingController } from './onboarding.controller';

const router = Router();

// Public onboarding guides (no auth required)
router.get('/whatsapp-setup', OnboardingController.whatsappSetupGuide);
router.get('/compliance', OnboardingController.complianceGuidelines);
router.get('/ui-guidelines', OnboardingController.uiGuidelines);
router.get('/quick-start', OnboardingController.quickStartGuide);

// User-specific onboarding (would require auth in production)
router.get('/status', OnboardingController.onboardingStatus);
router.post('/progress', OnboardingController.saveProgress);

export { router as onboardingRoutes };
