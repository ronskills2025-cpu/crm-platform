import { Router } from 'express';
import { GrowthController } from './growth.controller';
import { authenticate } from '../../../packages/utils/src/auth.middleware';

const router = Router();

// ── Dashboard ──
router.get('/dashboard', authenticate, GrowthController.getDashboard as never);

// ── Notifications ──
router.get('/notifications', authenticate, GrowthController.listNotifications as never);
router.patch('/notifications/read-all', authenticate, GrowthController.markAllNotificationsRead as never);
router.patch('/notifications/:id/read', authenticate, GrowthController.markNotificationRead as never);

// ══════════════════════════════════════════════════════════════════════════
//  MODULE 1: LEAD CAPTURE
// ══════════════════════════════════════════════════════════════════════════
router.get('/lead-capture/forms', authenticate, GrowthController.listForms as never);
router.post('/lead-capture/forms', authenticate, GrowthController.createForm as never);
router.get('/lead-capture/stats', authenticate, GrowthController.getLeadCaptureStats as never);
router.get('/lead-capture/submissions', authenticate, GrowthController.listSubmissions as never);
router.get('/lead-capture/forms/:id', authenticate, GrowthController.getForm as never);
router.put('/lead-capture/forms/:id', authenticate, GrowthController.updateForm as never);
router.delete('/lead-capture/forms/:id', authenticate, GrowthController.deleteForm as never);
// Public form submission (still needs tenant context from form_id)
router.post('/lead-capture/submit', authenticate, GrowthController.submitCapture as never);

// ══════════════════════════════════════════════════════════════════════════
//  MODULE 2: MISSED CALL
// ══════════════════════════════════════════════════════════════════════════
router.get('/missed-call/configs', authenticate, GrowthController.listMissedCallConfigs as never);
router.post('/missed-call/configs', authenticate, GrowthController.createMissedCallConfig as never);
router.get('/missed-call/stats', authenticate, GrowthController.getMissedCallStats as never);
router.get('/missed-call/calls', authenticate, GrowthController.listMissedCalls as never);
router.get('/missed-call/configs/:id', authenticate, GrowthController.getMissedCallConfig as never);
router.put('/missed-call/configs/:id', authenticate, GrowthController.updateMissedCallConfig as never);
router.delete('/missed-call/configs/:id', authenticate, GrowthController.deleteMissedCallConfig as never);
router.post('/missed-call/log', authenticate, GrowthController.logMissedCall as never);

// ══════════════════════════════════════════════════════════════════════════
//  MODULE 3: FOLLOW-UP
// ══════════════════════════════════════════════════════════════════════════
router.get('/followup/sequences', authenticate, GrowthController.listSequences as never);
router.post('/followup/sequences', authenticate, GrowthController.createSequence as never);
router.get('/followup/stats', authenticate, GrowthController.getFollowupStats as never);
router.get('/followup/enrollments', authenticate, GrowthController.listEnrollments as never);
router.get('/followup/sequences/:id', authenticate, GrowthController.getSequence as never);
router.put('/followup/sequences/:id', authenticate, GrowthController.updateSequence as never);
router.delete('/followup/sequences/:id', authenticate, GrowthController.deleteSequence as never);
router.patch('/followup/sequences/:id/toggle', authenticate, GrowthController.toggleSequence as never);
router.post('/followup/enroll', authenticate, GrowthController.enrollInSequence as never);

// ══════════════════════════════════════════════════════════════════════════
//  MODULE 4: LOYALTY
// ══════════════════════════════════════════════════════════════════════════
router.get('/loyalty/programs', authenticate, GrowthController.listLoyaltyPrograms as never);
router.post('/loyalty/programs', authenticate, GrowthController.createLoyaltyProgram as never);
router.get('/loyalty/stats', authenticate, GrowthController.getLoyaltyStats as never);
router.get('/loyalty/programs/:id', authenticate, GrowthController.getLoyaltyProgram as never);
router.put('/loyalty/programs/:id', authenticate, GrowthController.updateLoyaltyProgram as never);
router.get('/loyalty/members', authenticate, GrowthController.listLoyaltyMembers as never);
router.post('/loyalty/members', authenticate, GrowthController.addLoyaltyMember as never);
router.get('/loyalty/members/:id', authenticate, GrowthController.getLoyaltyMember as never);
router.get('/loyalty/members/:id/transactions', authenticate, GrowthController.getLoyaltyTransactions as never);
router.post('/loyalty/transactions', authenticate, GrowthController.addLoyaltyTransaction as never);
router.get('/loyalty/rewards', authenticate, GrowthController.listLoyaltyRewards as never);
router.post('/loyalty/rewards', authenticate, GrowthController.createLoyaltyReward as never);
router.post('/loyalty/members/:memberId/redeem/:rewardId', authenticate, GrowthController.redeemReward as never);

// ══════════════════════════════════════════════════════════════════════════
//  MODULE 5: REFERRAL
// ══════════════════════════════════════════════════════════════════════════
router.get('/referral/programs', authenticate, GrowthController.listReferralPrograms as never);
router.post('/referral/programs', authenticate, GrowthController.createReferralProgram as never);
router.get('/referral/stats', authenticate, GrowthController.getReferralStats as never);
router.get('/referral/programs/:id', authenticate, GrowthController.getReferralProgram as never);
router.put('/referral/programs/:id', authenticate, GrowthController.updateReferralProgram as never);
router.get('/referral/links', authenticate, GrowthController.listReferralLinks as never);
router.post('/referral/links', authenticate, GrowthController.createReferralLink as never);
router.get('/referral/referrals', authenticate, GrowthController.listReferrals as never);
router.post('/referral/referrals', authenticate, GrowthController.recordReferral as never);
router.patch('/referral/referrals/:id/convert', authenticate, GrowthController.convertReferral as never);
router.get('/referral/leaderboard/:programId', authenticate, GrowthController.getReferralLeaderboard as never);
// Public referral click tracking
router.get('/referral/track/:code', GrowthController.trackReferralClick as never);

// ══════════════════════════════════════════════════════════════════════════
//  MODULE 6: REVIEW BOOSTER
// ══════════════════════════════════════════════════════════════════════════
router.get('/reviews/campaigns', authenticate, GrowthController.listReviewCampaigns as never);
router.post('/reviews/campaigns', authenticate, GrowthController.createReviewCampaign as never);
router.get('/reviews/stats', authenticate, GrowthController.getReviewBoosterStats as never);
router.get('/reviews/campaigns/:id', authenticate, GrowthController.getReviewCampaign as never);
router.put('/reviews/campaigns/:id', authenticate, GrowthController.updateReviewCampaign as never);
router.delete('/reviews/campaigns/:id', authenticate, GrowthController.deleteReviewCampaign as never);
router.post('/reviews/requests', authenticate, GrowthController.createReviewRequest as never);
router.get('/reviews/campaigns/:campaignId/requests', authenticate, GrowthController.listReviewRequests as never);
// Public review response
router.post('/reviews/respond/:id', GrowthController.submitReviewResponse as never);

// ══════════════════════════════════════════════════════════════════════════
//  MODULE 7: PIPELINE
// ══════════════════════════════════════════════════════════════════════════
router.get('/pipeline/pipelines', authenticate, GrowthController.listPipelines as never);
router.post('/pipeline/pipelines', authenticate, GrowthController.createPipeline as never);
router.get('/pipeline/stats', authenticate, GrowthController.getPipelineStats as never);
router.get('/pipeline/pipelines/:id', authenticate, GrowthController.getPipeline as never);
router.put('/pipeline/pipelines/:id', authenticate, GrowthController.updatePipeline as never);
router.delete('/pipeline/pipelines/:id', authenticate, GrowthController.deletePipeline as never);
router.get('/pipeline/deals', authenticate, GrowthController.listDeals as never);
router.post('/pipeline/deals', authenticate, GrowthController.createDeal as never);
router.get('/pipeline/deals/:id', authenticate, GrowthController.getDeal as never);
router.put('/pipeline/deals/:id', authenticate, GrowthController.updateDeal as never);
router.patch('/pipeline/deals/:id/move', authenticate, GrowthController.moveDeal as never);
router.delete('/pipeline/deals/:id', authenticate, GrowthController.deleteDeal as never);
router.get('/pipeline/deals/:dealId/activities', authenticate, GrowthController.getActivities as never);
router.post('/pipeline/activities', authenticate, GrowthController.logActivity as never);

// ══════════════════════════════════════════════════════════════════════════
//  MODULE 8: BROADCAST
// ══════════════════════════════════════════════════════════════════════════
router.get('/broadcast/segments', authenticate, GrowthController.listSegments as never);
router.post('/broadcast/segments', authenticate, GrowthController.createSegment as never);
router.get('/broadcast/stats', authenticate, GrowthController.getBroadcastStats as never);
router.get('/broadcast/segments/:id', authenticate, GrowthController.getSegment as never);
router.put('/broadcast/segments/:id', authenticate, GrowthController.updateSegment as never);
router.delete('/broadcast/segments/:id', authenticate, GrowthController.deleteSegment as never);
router.get('/broadcast/segments/:id/contacts', authenticate, GrowthController.computeSegment as never);
router.get('/broadcast/campaigns', authenticate, GrowthController.listBroadcastCampaigns as never);
router.post('/broadcast/campaigns', authenticate, GrowthController.createBroadcastCampaign as never);
router.get('/broadcast/campaigns/:id', authenticate, GrowthController.getBroadcastCampaign as never);
router.put('/broadcast/campaigns/:id', authenticate, GrowthController.updateBroadcastCampaign as never);
router.delete('/broadcast/campaigns/:id', authenticate, GrowthController.deleteBroadcastCampaign as never);

// ══════════════════════════════════════════════════════════════════════════
//  MODULE 9: ADS TRACKER
// ══════════════════════════════════════════════════════════════════════════
router.get('/ads/campaigns', authenticate, GrowthController.listAdCampaigns as never);
router.post('/ads/campaigns', authenticate, GrowthController.createAdCampaign as never);
router.get('/ads/roi', authenticate, GrowthController.getAdROI as never);
router.get('/ads/platforms', authenticate, GrowthController.getAdsByPlatform as never);
router.get('/ads/campaigns/:id', authenticate, GrowthController.getAdCampaign as never);
router.put('/ads/campaigns/:id', authenticate, GrowthController.updateAdCampaign as never);
router.delete('/ads/campaigns/:id', authenticate, GrowthController.deleteAdCampaign as never);
router.get('/ads/campaigns/:campaignId/conversions', authenticate, GrowthController.listAdConversions as never);
router.post('/ads/conversions', authenticate, GrowthController.trackAdConversion as never);

// ══════════════════════════════════════════════════════════════════════════
//  MODULE 10: WEBSITE BUILDER
// ══════════════════════════════════════════════════════════════════════════
router.get('/websites', authenticate, GrowthController.listWebsites as never);
router.post('/websites', authenticate, GrowthController.createWebsite as never);
router.get('/websites/:id', authenticate, GrowthController.getWebsite as never);
router.put('/websites/:id', authenticate, GrowthController.updateWebsite as never);
router.patch('/websites/:id/publish', authenticate, GrowthController.publishWebsite as never);
router.patch('/websites/:id/unpublish', authenticate, GrowthController.unpublishWebsite as never);
router.delete('/websites/:id', authenticate, GrowthController.deleteWebsite as never);
// Public website access
router.get('/websites/public/:slug', GrowthController.getPublicWebsite as never);
router.post('/websites/public/:slug/form', GrowthController.submitWebsiteForm as never);

export default router;
