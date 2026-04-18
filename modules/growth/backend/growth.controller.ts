import { Response } from 'express';
import { AuthRequest } from '../../../packages/utils/src/auth.middleware';
import {
  LeadCaptureService, MissedCallService, FollowupService, LoyaltyService,
  ReferralService, ReviewBoosterService, PipelineService, BroadcastService,
  AdsService, WebsiteService, GrowthNotificationService, GrowthDashboardService,
} from './growth.service';
import {
  CreateLeadCaptureFormSchema, UpdateLeadCaptureFormSchema, SubmitLeadCaptureSchema,
  CreateMissedCallConfigSchema, UpdateMissedCallConfigSchema, LogMissedCallSchema,
  CreateFollowupSequenceSchema, UpdateFollowupSequenceSchema, EnrollFollowupSchema,
  CreateLoyaltyProgramSchema, UpdateLoyaltyProgramSchema, AddLoyaltyMemberSchema, LoyaltyTransactionSchema, CreateLoyaltyRewardSchema,
  CreateReferralProgramSchema, UpdateReferralProgramSchema, CreateReferralLinkSchema, RecordReferralSchema,
  CreateReviewCampaignSchema, UpdateReviewCampaignSchema, CreateReviewRequestSchema, SubmitReviewResponseSchema,
  CreatePipelineSchema, UpdatePipelineSchema, CreateDealSchema, UpdateDealSchema, MoveDealSchema, LogActivitySchema,
  CreateBroadcastSegmentSchema, UpdateBroadcastSegmentSchema, CreateBroadcastCampaignSchema,
  CreateAdCampaignSchema, UpdateAdCampaignSchema, TrackAdConversionSchema,
  CreateMiniWebsiteSchema, UpdateMiniWebsiteSchema,
  ListNotificationsQuerySchema,
} from './Growth';

function tid(req: AuthRequest): string { return req.tenantId!; }

export class GrowthController {

  // ── DASHBOARD ──
  static async getDashboard(req: AuthRequest, res: Response) {
    try {
      const data = await GrowthDashboardService.getOverview(tid(req));
      res.json(data);
    } catch (e) { res.status(500).json({ error: (e as Error).message }); }
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  MODULE 1: LEAD CAPTURE
  // ══════════════════════════════════════════════════════════════════════════

  static async createForm(req: AuthRequest, res: Response) {
    try {
      const data = CreateLeadCaptureFormSchema.parse(req.body);
      const form = await LeadCaptureService.createForm(tid(req), data);
      res.status(201).json({ form });
    } catch (e) { res.status(400).json({ error: (e as Error).message }); }
  }

  static async listForms(req: AuthRequest, res: Response) {
    try {
      const forms = await LeadCaptureService.listForms(tid(req));
      res.json({ forms });
    } catch (e) { res.status(500).json({ error: (e as Error).message }); }
  }

  static async getForm(req: AuthRequest, res: Response) {
    try {
      const form = await LeadCaptureService.getForm(tid(req), req.params.id);
      if (!form) return res.status(404).json({ error: 'Not found' });
      res.json({ form });
    } catch (e) { res.status(500).json({ error: (e as Error).message }); }
  }

  static async updateForm(req: AuthRequest, res: Response) {
    try {
      const data = UpdateLeadCaptureFormSchema.parse(req.body);
      const form = await LeadCaptureService.updateForm(tid(req), req.params.id, data);
      res.json({ form });
    } catch (e) { res.status(400).json({ error: (e as Error).message }); }
  }

  static async deleteForm(req: AuthRequest, res: Response) {
    try {
      await LeadCaptureService.deleteForm(tid(req), req.params.id);
      res.json({ success: true });
    } catch (e) { res.status(500).json({ error: (e as Error).message }); }
  }

  static async submitCapture(req: AuthRequest, res: Response) {
    try {
      const data = SubmitLeadCaptureSchema.parse(req.body);
      const submission = await LeadCaptureService.submitCapture(tid(req), { ...data, ip_address: req.ip, user_agent: req.headers['user-agent'] });
      res.status(201).json({ submission });
    } catch (e) { res.status(400).json({ error: (e as Error).message }); }
  }

  static async listSubmissions(req: AuthRequest, res: Response) {
    try {
      const submissions = await LeadCaptureService.listSubmissions(tid(req), req.query as Record<string, unknown>);
      res.json({ submissions });
    } catch (e) { res.status(500).json({ error: (e as Error).message }); }
  }

  static async getLeadCaptureStats(req: AuthRequest, res: Response) {
    try {
      const stats = await LeadCaptureService.getStats(tid(req));
      res.json({ stats });
    } catch (e) { res.status(500).json({ error: (e as Error).message }); }
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  MODULE 2: MISSED CALL
  // ══════════════════════════════════════════════════════════════════════════

  static async createMissedCallConfig(req: AuthRequest, res: Response) {
    try {
      const data = CreateMissedCallConfigSchema.parse(req.body);
      const config = await MissedCallService.createConfig(tid(req), data);
      res.status(201).json({ config });
    } catch (e) { res.status(400).json({ error: (e as Error).message }); }
  }

  static async listMissedCallConfigs(req: AuthRequest, res: Response) {
    try {
      const configs = await MissedCallService.listConfigs(tid(req));
      res.json({ configs });
    } catch (e) { res.status(500).json({ error: (e as Error).message }); }
  }

  static async getMissedCallConfig(req: AuthRequest, res: Response) {
    try {
      const config = await MissedCallService.getConfig(tid(req), req.params.id);
      if (!config) return res.status(404).json({ error: 'Not found' });
      res.json({ config });
    } catch (e) { res.status(500).json({ error: (e as Error).message }); }
  }

  static async updateMissedCallConfig(req: AuthRequest, res: Response) {
    try {
      const data = UpdateMissedCallConfigSchema.parse(req.body);
      const config = await MissedCallService.updateConfig(tid(req), req.params.id, data);
      res.json({ config });
    } catch (e) { res.status(400).json({ error: (e as Error).message }); }
  }

  static async deleteMissedCallConfig(req: AuthRequest, res: Response) {
    try {
      await MissedCallService.deleteConfig(tid(req), req.params.id);
      res.json({ success: true });
    } catch (e) { res.status(500).json({ error: (e as Error).message }); }
  }

  static async logMissedCall(req: AuthRequest, res: Response) {
    try {
      const data = LogMissedCallSchema.parse(req.body);
      const call = await MissedCallService.logMissedCall(tid(req), data);
      res.status(201).json({ call });
    } catch (e) { res.status(400).json({ error: (e as Error).message }); }
  }

  static async listMissedCalls(req: AuthRequest, res: Response) {
    try {
      const calls = await MissedCallService.listMissedCalls(tid(req), req.query as Record<string, unknown>);
      res.json({ calls });
    } catch (e) { res.status(500).json({ error: (e as Error).message }); }
  }

  static async getMissedCallStats(req: AuthRequest, res: Response) {
    try {
      const stats = await MissedCallService.getStats(tid(req));
      res.json({ stats });
    } catch (e) { res.status(500).json({ error: (e as Error).message }); }
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  MODULE 3: FOLLOW-UP
  // ══════════════════════════════════════════════════════════════════════════

  static async createSequence(req: AuthRequest, res: Response) {
    try {
      const data = CreateFollowupSequenceSchema.parse(req.body);
      const sequence = await FollowupService.createSequence(tid(req), data);
      res.status(201).json({ sequence });
    } catch (e) { res.status(400).json({ error: (e as Error).message }); }
  }

  static async listSequences(req: AuthRequest, res: Response) {
    try {
      const sequences = await FollowupService.listSequences(tid(req));
      res.json({ sequences });
    } catch (e) { res.status(500).json({ error: (e as Error).message }); }
  }

  static async getSequence(req: AuthRequest, res: Response) {
    try {
      const sequence = await FollowupService.getSequence(tid(req), req.params.id);
      if (!sequence) return res.status(404).json({ error: 'Not found' });
      res.json({ sequence });
    } catch (e) { res.status(500).json({ error: (e as Error).message }); }
  }

  static async updateSequence(req: AuthRequest, res: Response) {
    try {
      const data = UpdateFollowupSequenceSchema.parse(req.body);
      const sequence = await FollowupService.updateSequence(tid(req), req.params.id, data);
      res.json({ sequence });
    } catch (e) { res.status(400).json({ error: (e as Error).message }); }
  }

  static async deleteSequence(req: AuthRequest, res: Response) {
    try {
      await FollowupService.deleteSequence(tid(req), req.params.id);
      res.json({ success: true });
    } catch (e) { res.status(500).json({ error: (e as Error).message }); }
  }

  static async toggleSequence(req: AuthRequest, res: Response) {
    try {
      const sequence = await FollowupService.toggleSequence(tid(req), req.params.id);
      res.json({ sequence });
    } catch (e) { res.status(500).json({ error: (e as Error).message }); }
  }

  static async enrollInSequence(req: AuthRequest, res: Response) {
    try {
      const data = EnrollFollowupSchema.parse(req.body);
      const enrollment = await FollowupService.enrollLead(tid(req), data);
      res.status(201).json({ enrollment });
    } catch (e) { res.status(400).json({ error: (e as Error).message }); }
  }

  static async listEnrollments(req: AuthRequest, res: Response) {
    try {
      const enrollments = await FollowupService.listEnrollments(tid(req), req.query as Record<string, unknown>);
      res.json({ enrollments });
    } catch (e) { res.status(500).json({ error: (e as Error).message }); }
  }

  static async getFollowupStats(req: AuthRequest, res: Response) {
    try {
      const stats = await FollowupService.getStats(tid(req));
      res.json({ stats });
    } catch (e) { res.status(500).json({ error: (e as Error).message }); }
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  MODULE 4: LOYALTY
  // ══════════════════════════════════════════════════════════════════════════

  static async createLoyaltyProgram(req: AuthRequest, res: Response) {
    try {
      const data = CreateLoyaltyProgramSchema.parse(req.body);
      const program = await LoyaltyService.createProgram(tid(req), data);
      res.status(201).json({ program });
    } catch (e) { res.status(400).json({ error: (e as Error).message }); }
  }

  static async listLoyaltyPrograms(req: AuthRequest, res: Response) {
    try {
      const programs = await LoyaltyService.listPrograms(tid(req));
      res.json({ programs });
    } catch (e) { res.status(500).json({ error: (e as Error).message }); }
  }

  static async getLoyaltyProgram(req: AuthRequest, res: Response) {
    try {
      const program = await LoyaltyService.getProgram(tid(req), req.params.id);
      if (!program) return res.status(404).json({ error: 'Not found' });
      res.json({ program });
    } catch (e) { res.status(500).json({ error: (e as Error).message }); }
  }

  static async updateLoyaltyProgram(req: AuthRequest, res: Response) {
    try {
      const data = UpdateLoyaltyProgramSchema.parse(req.body);
      const program = await LoyaltyService.updateProgram(tid(req), req.params.id, data);
      res.json({ program });
    } catch (e) { res.status(400).json({ error: (e as Error).message }); }
  }

  static async addLoyaltyMember(req: AuthRequest, res: Response) {
    try {
      const data = AddLoyaltyMemberSchema.parse(req.body);
      const member = await LoyaltyService.addMember(tid(req), data);
      res.status(201).json({ member });
    } catch (e) { res.status(400).json({ error: (e as Error).message }); }
  }

  static async listLoyaltyMembers(req: AuthRequest, res: Response) {
    try {
      const result = await LoyaltyService.listMembers(tid(req), req.query as Record<string, unknown>);
      res.json({ members: result.members, total: result.total });
    } catch (e) { res.status(500).json({ error: (e as Error).message }); }
  }

  static async getLoyaltyMember(req: AuthRequest, res: Response) {
    try {
      const member = await LoyaltyService.getMember(tid(req), req.params.id);
      if (!member) return res.status(404).json({ error: 'Not found' });
      res.json({ member });
    } catch (e) { res.status(500).json({ error: (e as Error).message }); }
  }

  static async addLoyaltyTransaction(req: AuthRequest, res: Response) {
    try {
      const data = LoyaltyTransactionSchema.parse(req.body);
      const transaction = await LoyaltyService.addTransaction(tid(req), data);
      res.status(201).json({ transaction });
    } catch (e) { res.status(400).json({ error: (e as Error).message }); }
  }

  static async getLoyaltyTransactions(req: AuthRequest, res: Response) {
    try {
      const transactions = await LoyaltyService.getTransactions(tid(req), req.params.id);
      res.json({ transactions });
    } catch (e) { res.status(500).json({ error: (e as Error).message }); }
  }

  static async createLoyaltyReward(req: AuthRequest, res: Response) {
    try {
      const data = CreateLoyaltyRewardSchema.parse(req.body);
      const reward = await LoyaltyService.createReward(tid(req), data);
      res.status(201).json({ reward });
    } catch (e) { res.status(400).json({ error: (e as Error).message }); }
  }

  static async listLoyaltyRewards(req: AuthRequest, res: Response) {
    try {
      const rewards = await LoyaltyService.listRewards(tid(req), req.query.program_id as string);
      res.json({ rewards });
    } catch (e) { res.status(500).json({ error: (e as Error).message }); }
  }

  static async redeemReward(req: AuthRequest, res: Response) {
    try {
      const result = await LoyaltyService.redeemReward(tid(req), req.params.memberId, req.params.rewardId);
      res.json(result);
    } catch (e) { res.status(400).json({ error: (e as Error).message }); }
  }

  static async getLoyaltyStats(req: AuthRequest, res: Response) {
    try {
      const stats = await LoyaltyService.getStats(tid(req));
      res.json({ stats });
    } catch (e) { res.status(500).json({ error: (e as Error).message }); }
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  MODULE 5: REFERRAL
  // ══════════════════════════════════════════════════════════════════════════

  static async createReferralProgram(req: AuthRequest, res: Response) {
    try {
      const data = CreateReferralProgramSchema.parse(req.body);
      const program = await ReferralService.createProgram(tid(req), data);
      res.status(201).json({ program });
    } catch (e) { res.status(400).json({ error: (e as Error).message }); }
  }

  static async listReferralPrograms(req: AuthRequest, res: Response) {
    try {
      const programs = await ReferralService.listPrograms(tid(req));
      res.json({ programs });
    } catch (e) { res.status(500).json({ error: (e as Error).message }); }
  }

  static async getReferralProgram(req: AuthRequest, res: Response) {
    try {
      const program = await ReferralService.getProgram(tid(req), req.params.id);
      if (!program) return res.status(404).json({ error: 'Not found' });
      res.json({ program });
    } catch (e) { res.status(500).json({ error: (e as Error).message }); }
  }

  static async updateReferralProgram(req: AuthRequest, res: Response) {
    try {
      const data = UpdateReferralProgramSchema.parse(req.body);
      const program = await ReferralService.updateProgram(tid(req), req.params.id, data);
      res.json({ program });
    } catch (e) { res.status(400).json({ error: (e as Error).message }); }
  }

  static async createReferralLink(req: AuthRequest, res: Response) {
    try {
      const data = CreateReferralLinkSchema.parse(req.body);
      const link = await ReferralService.createLink(tid(req), data);
      res.status(201).json({ link });
    } catch (e) { res.status(400).json({ error: (e as Error).message }); }
  }

  static async listReferralLinks(req: AuthRequest, res: Response) {
    try {
      const links = await ReferralService.listLinks(tid(req), req.query.program_id as string);
      res.json({ links });
    } catch (e) { res.status(500).json({ error: (e as Error).message }); }
  }

  static async trackReferralClick(req: AuthRequest, res: Response) {
    try {
      const link = await ReferralService.getLinkByCode(req.params.code);
      if (!link) return res.status(404).json({ error: 'Link not found' });
      await ReferralService.trackClick(req.params.code);
      res.json({ link });
    } catch (e) { res.status(500).json({ error: (e as Error).message }); }
  }

  static async recordReferral(req: AuthRequest, res: Response) {
    try {
      const data = RecordReferralSchema.parse(req.body);
      const referral = await ReferralService.recordReferral(tid(req), data);
      res.status(201).json({ referral });
    } catch (e) { res.status(400).json({ error: (e as Error).message }); }
  }

  static async convertReferral(req: AuthRequest, res: Response) {
    try {
      const referral = await ReferralService.convertReferral(tid(req), req.params.id);
      res.json({ referral });
    } catch (e) { res.status(500).json({ error: (e as Error).message }); }
  }

  static async listReferrals(req: AuthRequest, res: Response) {
    try {
      const referrals = await ReferralService.listReferrals(tid(req), req.query as Record<string, unknown>);
      res.json({ referrals });
    } catch (e) { res.status(500).json({ error: (e as Error).message }); }
  }

  static async getReferralLeaderboard(req: AuthRequest, res: Response) {
    try {
      const leaderboard = await ReferralService.getLeaderboard(tid(req), req.params.programId);
      res.json({ leaderboard });
    } catch (e) { res.status(500).json({ error: (e as Error).message }); }
  }

  static async getReferralStats(req: AuthRequest, res: Response) {
    try {
      const stats = await ReferralService.getStats(tid(req));
      res.json({ stats });
    } catch (e) { res.status(500).json({ error: (e as Error).message }); }
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  MODULE 6: REVIEW BOOSTER
  // ══════════════════════════════════════════════════════════════════════════

  static async createReviewCampaign(req: AuthRequest, res: Response) {
    try {
      const data = CreateReviewCampaignSchema.parse(req.body);
      const campaign = await ReviewBoosterService.createCampaign(tid(req), data);
      res.status(201).json({ campaign });
    } catch (e) { res.status(400).json({ error: (e as Error).message }); }
  }

  static async listReviewCampaigns(req: AuthRequest, res: Response) {
    try {
      const campaigns = await ReviewBoosterService.listCampaigns(tid(req));
      res.json({ campaigns });
    } catch (e) { res.status(500).json({ error: (e as Error).message }); }
  }

  static async getReviewCampaign(req: AuthRequest, res: Response) {
    try {
      const campaign = await ReviewBoosterService.getCampaign(tid(req), req.params.id);
      if (!campaign) return res.status(404).json({ error: 'Not found' });
      res.json({ campaign });
    } catch (e) { res.status(500).json({ error: (e as Error).message }); }
  }

  static async updateReviewCampaign(req: AuthRequest, res: Response) {
    try {
      const data = UpdateReviewCampaignSchema.parse(req.body);
      const campaign = await ReviewBoosterService.updateCampaign(tid(req), req.params.id, data);
      res.json({ campaign });
    } catch (e) { res.status(400).json({ error: (e as Error).message }); }
  }

  static async deleteReviewCampaign(req: AuthRequest, res: Response) {
    try {
      await ReviewBoosterService.deleteCampaign(tid(req), req.params.id);
      res.json({ success: true });
    } catch (e) { res.status(500).json({ error: (e as Error).message }); }
  }

  static async createReviewRequest(req: AuthRequest, res: Response) {
    try {
      const data = CreateReviewRequestSchema.parse(req.body);
      const request = await ReviewBoosterService.createRequest(tid(req), data);
      res.status(201).json({ request });
    } catch (e) { res.status(400).json({ error: (e as Error).message }); }
  }

  static async submitReviewResponse(req: AuthRequest, res: Response) {
    try {
      const data = SubmitReviewResponseSchema.parse(req.body);
      const result = await ReviewBoosterService.submitResponse(req.params.id, data.rating, data.feedback);
      res.json(result);
    } catch (e) { res.status(400).json({ error: (e as Error).message }); }
  }

  static async listReviewRequests(req: AuthRequest, res: Response) {
    try {
      const requests = await ReviewBoosterService.listRequests(tid(req), req.params.campaignId, req.query as Record<string, unknown>);
      res.json({ requests });
    } catch (e) { res.status(500).json({ error: (e as Error).message }); }
  }

  static async getReviewBoosterStats(req: AuthRequest, res: Response) {
    try {
      const stats = await ReviewBoosterService.getStats(tid(req));
      res.json({ stats });
    } catch (e) { res.status(500).json({ error: (e as Error).message }); }
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  MODULE 7: PIPELINE
  // ══════════════════════════════════════════════════════════════════════════

  static async createPipeline(req: AuthRequest, res: Response) {
    try {
      const data = CreatePipelineSchema.parse(req.body);
      const pipeline = await PipelineService.createPipeline(tid(req), data);
      res.status(201).json({ pipeline });
    } catch (e) { res.status(400).json({ error: (e as Error).message }); }
  }

  static async listPipelines(req: AuthRequest, res: Response) {
    try {
      const pipelines = await PipelineService.listPipelines(tid(req));
      res.json({ pipelines });
    } catch (e) { res.status(500).json({ error: (e as Error).message }); }
  }

  static async getPipeline(req: AuthRequest, res: Response) {
    try {
      const pipeline = await PipelineService.getPipeline(tid(req), req.params.id);
      if (!pipeline) return res.status(404).json({ error: 'Not found' });
      res.json({ pipeline });
    } catch (e) { res.status(500).json({ error: (e as Error).message }); }
  }

  static async updatePipeline(req: AuthRequest, res: Response) {
    try {
      const data = UpdatePipelineSchema.parse(req.body);
      const pipeline = await PipelineService.updatePipeline(tid(req), req.params.id, data);
      res.json({ pipeline });
    } catch (e) { res.status(400).json({ error: (e as Error).message }); }
  }

  static async deletePipeline(req: AuthRequest, res: Response) {
    try {
      await PipelineService.deletePipeline(tid(req), req.params.id);
      res.json({ success: true });
    } catch (e) { res.status(500).json({ error: (e as Error).message }); }
  }

  static async createDeal(req: AuthRequest, res: Response) {
    try {
      const data = CreateDealSchema.parse(req.body);
      const deal = await PipelineService.createDeal(tid(req), data);
      res.status(201).json({ deal });
    } catch (e) { res.status(400).json({ error: (e as Error).message }); }
  }

  static async listDeals(req: AuthRequest, res: Response) {
    try {
      const result = await PipelineService.listDeals(tid(req), req.query as Record<string, unknown>);
      res.json({ deals: result.deals, total: result.total });
    } catch (e) { res.status(500).json({ error: (e as Error).message }); }
  }

  static async getDeal(req: AuthRequest, res: Response) {
    try {
      const deal = await PipelineService.getDeal(tid(req), req.params.id);
      if (!deal) return res.status(404).json({ error: 'Not found' });
      res.json({ deal });
    } catch (e) { res.status(500).json({ error: (e as Error).message }); }
  }

  static async updateDeal(req: AuthRequest, res: Response) {
    try {
      const data = UpdateDealSchema.parse(req.body);
      const deal = await PipelineService.updateDeal(tid(req), req.params.id, data);
      res.json({ deal });
    } catch (e) { res.status(400).json({ error: (e as Error).message }); }
  }

  static async moveDeal(req: AuthRequest, res: Response) {
    try {
      const { stage, position } = MoveDealSchema.parse(req.body);
      const deal = await PipelineService.moveDeal(tid(req), req.params.id, stage, position);
      res.json({ deal });
    } catch (e) { res.status(400).json({ error: (e as Error).message }); }
  }

  static async deleteDeal(req: AuthRequest, res: Response) {
    try {
      await PipelineService.deleteDeal(tid(req), req.params.id);
      res.json({ success: true });
    } catch (e) { res.status(500).json({ error: (e as Error).message }); }
  }

  static async logActivity(req: AuthRequest, res: Response) {
    try {
      const data = LogActivitySchema.parse(req.body);
      const activity = await PipelineService.logActivity(tid(req), { ...data, performed_by: req.userId });
      res.status(201).json({ activity });
    } catch (e) { res.status(400).json({ error: (e as Error).message }); }
  }

  static async getActivities(req: AuthRequest, res: Response) {
    try {
      const activities = await PipelineService.getActivities(tid(req), req.params.dealId);
      res.json({ activities });
    } catch (e) { res.status(500).json({ error: (e as Error).message }); }
  }

  static async getPipelineStats(req: AuthRequest, res: Response) {
    try {
      const stats = await PipelineService.getStats(tid(req), req.query.pipeline_id as string);
      res.json({ stats });
    } catch (e) { res.status(500).json({ error: (e as Error).message }); }
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  MODULE 8: BROADCAST
  // ══════════════════════════════════════════════════════════════════════════

  static async createSegment(req: AuthRequest, res: Response) {
    try {
      const data = CreateBroadcastSegmentSchema.parse(req.body);
      const segment = await BroadcastService.createSegment(tid(req), data);
      res.status(201).json({ segment });
    } catch (e) { res.status(400).json({ error: (e as Error).message }); }
  }

  static async listSegments(req: AuthRequest, res: Response) {
    try {
      const result = await BroadcastService.listSegments(tid(req), req.query as Record<string, unknown>);
      res.json({ segments: result.segments, total: result.total });
    } catch (e) { res.status(500).json({ error: (e as Error).message }); }
  }

  static async getSegment(req: AuthRequest, res: Response) {
    try {
      const segment = await BroadcastService.getSegment(tid(req), req.params.id);
      if (!segment) return res.status(404).json({ error: 'Not found' });
      res.json({ segment });
    } catch (e) { res.status(500).json({ error: (e as Error).message }); }
  }

  static async updateSegment(req: AuthRequest, res: Response) {
    try {
      const data = UpdateBroadcastSegmentSchema.parse(req.body);
      const segment = await BroadcastService.updateSegment(tid(req), req.params.id, data);
      res.json({ segment });
    } catch (e) { res.status(400).json({ error: (e as Error).message }); }
  }

  static async deleteSegment(req: AuthRequest, res: Response) {
    try {
      await BroadcastService.deleteSegment(tid(req), req.params.id);
      res.json({ success: true });
    } catch (e) { res.status(500).json({ error: (e as Error).message }); }
  }

  static async computeSegment(req: AuthRequest, res: Response) {
    try {
      const contacts = await BroadcastService.computeSegmentContacts(tid(req), req.params.id);
      res.json({ contacts, count: contacts.length });
    } catch (e) { res.status(500).json({ error: (e as Error).message }); }
  }

  static async createBroadcastCampaign(req: AuthRequest, res: Response) {
    try {
      const data = CreateBroadcastCampaignSchema.parse(req.body);
      const campaign = await BroadcastService.createCampaign(tid(req), data);
      res.status(201).json({ campaign });
    } catch (e) { res.status(400).json({ error: (e as Error).message }); }
  }

  static async listBroadcastCampaigns(req: AuthRequest, res: Response) {
    try {
      const result = await BroadcastService.listCampaigns(tid(req), req.query as Record<string, unknown>);
      res.json({ campaigns: result.campaigns, total: result.total });
    } catch (e) { res.status(500).json({ error: (e as Error).message }); }
  }

  static async getBroadcastCampaign(req: AuthRequest, res: Response) {
    try {
      const campaign = await BroadcastService.getCampaign(tid(req), req.params.id);
      if (!campaign) return res.status(404).json({ error: 'Not found' });
      res.json({ campaign });
    } catch (e) { res.status(500).json({ error: (e as Error).message }); }
  }

  static async updateBroadcastCampaign(req: AuthRequest, res: Response) {
    try {
      const data = CreateBroadcastCampaignSchema.partial().parse(req.body);
      const campaign = await BroadcastService.updateCampaign(tid(req), req.params.id, data);
      res.json({ campaign });
    } catch (e) { res.status(400).json({ error: (e as Error).message }); }
  }

  static async deleteBroadcastCampaign(req: AuthRequest, res: Response) {
    try {
      await BroadcastService.deleteCampaign(tid(req), req.params.id);
      res.json({ success: true });
    } catch (e) { res.status(500).json({ error: (e as Error).message }); }
  }

  static async getBroadcastStats(req: AuthRequest, res: Response) {
    try {
      const stats = await BroadcastService.getStats(tid(req));
      res.json({ stats });
    } catch (e) { res.status(500).json({ error: (e as Error).message }); }
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  MODULE 9: ADS TRACKER
  // ══════════════════════════════════════════════════════════════════════════

  static async createAdCampaign(req: AuthRequest, res: Response) {
    try {
      const data = CreateAdCampaignSchema.parse(req.body);
      const campaign = await AdsService.createCampaign(tid(req), data);
      res.status(201).json({ campaign });
    } catch (e) { res.status(400).json({ error: (e as Error).message }); }
  }

  static async listAdCampaigns(req: AuthRequest, res: Response) {
    try {
      const campaigns = await AdsService.listCampaigns(tid(req), req.query as Record<string, unknown>);
      res.json({ campaigns });
    } catch (e) { res.status(500).json({ error: (e as Error).message }); }
  }

  static async getAdCampaign(req: AuthRequest, res: Response) {
    try {
      const campaign = await AdsService.getCampaign(tid(req), req.params.id);
      if (!campaign) return res.status(404).json({ error: 'Not found' });
      res.json({ campaign });
    } catch (e) { res.status(500).json({ error: (e as Error).message }); }
  }

  static async updateAdCampaign(req: AuthRequest, res: Response) {
    try {
      const data = UpdateAdCampaignSchema.parse(req.body);
      const campaign = await AdsService.updateCampaign(tid(req), req.params.id, data);
      res.json({ campaign });
    } catch (e) { res.status(400).json({ error: (e as Error).message }); }
  }

  static async deleteAdCampaign(req: AuthRequest, res: Response) {
    try {
      await AdsService.deleteCampaign(tid(req), req.params.id);
      res.json({ success: true });
    } catch (e) { res.status(500).json({ error: (e as Error).message }); }
  }

  static async trackAdConversion(req: AuthRequest, res: Response) {
    try {
      const data = TrackAdConversionSchema.parse(req.body);
      const conversion = await AdsService.trackConversion(tid(req), data);
      res.status(201).json({ conversion });
    } catch (e) { res.status(400).json({ error: (e as Error).message }); }
  }

  static async listAdConversions(req: AuthRequest, res: Response) {
    try {
      const conversions = await AdsService.listConversions(tid(req), req.params.campaignId);
      res.json({ conversions });
    } catch (e) { res.status(500).json({ error: (e as Error).message }); }
  }

  static async getAdROI(req: AuthRequest, res: Response) {
    try {
      const roi = await AdsService.getROIDashboard(tid(req));
      res.json({ roi });
    } catch (e) { res.status(500).json({ error: (e as Error).message }); }
  }

  static async getAdsByPlatform(req: AuthRequest, res: Response) {
    try {
      const platforms = await AdsService.getByPlatform(tid(req));
      res.json({ platforms });
    } catch (e) { res.status(500).json({ error: (e as Error).message }); }
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  MODULE 10: WEBSITE BUILDER
  // ══════════════════════════════════════════════════════════════════════════

  static async createWebsite(req: AuthRequest, res: Response) {
    try {
      const data = CreateMiniWebsiteSchema.parse(req.body);
      const website = await WebsiteService.create(tid(req), data);
      res.status(201).json({ website });
    } catch (e) { res.status(400).json({ error: (e as Error).message }); }
  }

  static async listWebsites(req: AuthRequest, res: Response) {
    try {
      const websites = await WebsiteService.list(tid(req));
      res.json({ websites });
    } catch (e) { res.status(500).json({ error: (e as Error).message }); }
  }

  static async getWebsite(req: AuthRequest, res: Response) {
    try {
      const website = await WebsiteService.getById(tid(req), req.params.id);
      if (!website) return res.status(404).json({ error: 'Not found' });
      res.json({ website });
    } catch (e) { res.status(500).json({ error: (e as Error).message }); }
  }

  static async updateWebsite(req: AuthRequest, res: Response) {
    try {
      const data = UpdateMiniWebsiteSchema.parse(req.body);
      const website = await WebsiteService.update(tid(req), req.params.id, data);
      res.json({ website });
    } catch (e) { res.status(400).json({ error: (e as Error).message }); }
  }

  static async publishWebsite(req: AuthRequest, res: Response) {
    try {
      const website = await WebsiteService.publish(tid(req), req.params.id);
      res.json({ website });
    } catch (e) { res.status(500).json({ error: (e as Error).message }); }
  }

  static async unpublishWebsite(req: AuthRequest, res: Response) {
    try {
      const website = await WebsiteService.unpublish(tid(req), req.params.id);
      res.json({ website });
    } catch (e) { res.status(500).json({ error: (e as Error).message }); }
  }

  static async deleteWebsite(req: AuthRequest, res: Response) {
    try {
      await WebsiteService.delete(tid(req), req.params.id);
      res.json({ success: true });
    } catch (e) { res.status(500).json({ error: (e as Error).message }); }
  }

  static async getPublicWebsite(req: AuthRequest, res: Response) {
    try {
      const website = await WebsiteService.getBySlug(req.params.slug);
      if (!website) return res.status(404).json({ error: 'Not found' });
      res.json({ website });
    } catch (e) { res.status(500).json({ error: (e as Error).message }); }
  }

  static async submitWebsiteForm(req: AuthRequest, res: Response) {
    try {
      const result = await WebsiteService.submitForm(req.params.slug, req.body);
      res.json(result);
    } catch (e) { res.status(400).json({ error: (e as Error).message }); }
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  NOTIFICATIONS
  // ══════════════════════════════════════════════════════════════════════════

  static async listNotifications(req: AuthRequest, res: Response) {
    try {
      const opts = ListNotificationsQuerySchema.parse(req.query);
      const notifications = await GrowthNotificationService.list(tid(req), opts);
      const unread = await GrowthNotificationService.getUnreadCount(tid(req));
      res.json({ notifications, unread });
    } catch (e) { res.status(500).json({ error: (e as Error).message }); }
  }

  static async markNotificationRead(req: AuthRequest, res: Response) {
    try {
      await GrowthNotificationService.markRead(tid(req), req.params.id);
      res.json({ success: true });
    } catch (e) { res.status(500).json({ error: (e as Error).message }); }
  }

  static async markAllNotificationsRead(req: AuthRequest, res: Response) {
    try {
      await GrowthNotificationService.markAllRead(tid(req));
      res.json({ success: true });
    } catch (e) { res.status(500).json({ error: (e as Error).message }); }
  }
}
