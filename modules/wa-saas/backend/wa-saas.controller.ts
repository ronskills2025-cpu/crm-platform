import { Response } from 'express';
import { AuthRequest } from '../../../packages/utils/src/auth.middleware';
import {
  CreateDripCampaignSchema, UpdateDripCampaignSchema, CreateDripStepSchema, UpdateDripStepSchema, EnrollDripSchema,
  CreateAiBotConfigSchema, UpdateAiBotConfigSchema, CreateFaqEntrySchema, UpdateFaqEntrySchema, AiConversationActionSchema,
  CreateOrderConfigSchema, UpdateOrderConfigSchema, CreateOrderSchema, UpdateOrderSchema, CreateOrderEventSchema,
  CreateSubPlanSchema, UpdateSubPlanSchema, CreateSubscriptionSchema, SubscriptionActionSchema, RecordSubPaymentSchema,
  CreateFlashSaleSchema, UpdateFlashSaleSchema, FlashSaleActionSchema,
  CreateAgentSchema, UpdateAgentSchema, AssignConversationSchema, AddTagsSchema, CreateNoteSchema, TeamReplySchema,
  CreateTrackedLinkSchema, UpdateTrackedLinkSchema, RecordConversionSchema,
  CreateReengagementSchema, UpdateReengagementSchema, ReengagementActionSchema,
  CreateBroadcastOptimizerSchema, UpdateBroadcastOptimizerSchema, CreateBroadcastBatchSchema, UpdateBroadcastBatchSchema,
  CreateBusinessCardSchema, UpdateBusinessCardSchema, BusinessCardLeadSchema,
} from './WaSaas';
import {
  DripService, AiBotService, OrderTrackingService, SubscriptionBotService, FlashSaleService,
  TeamInboxService, LinkTrackingService, ReengagementService, BroadcastOptimizerService, BusinessCardService,
  WaSaasNotificationService, WaSaasDashboardService,
} from './wa-saas.service';

const tid = (r: AuthRequest) => r.tenantId!;

export class WaSaasController {
  // ══════════════════════════════════════════════════════════════════════
  //  DASHBOARD
  // ══════════════════════════════════════════════════════════════════════
  static async getDashboard(req: AuthRequest, res: Response) {
    try { res.json(await WaSaasDashboardService.getOverview(tid(req))); } catch (e) { res.status(500).json({ error: (e as Error).message }); }
  }

  // ══════════════════════════════════════════════════════════════════════
  //  NOTIFICATIONS
  // ══════════════════════════════════════════════════════════════════════
  static async listNotifications(req: AuthRequest, res: Response) {
    try { res.json(await WaSaasNotificationService.list(tid(req), req.query.module as string, req.query.is_read === 'true' ? true : req.query.is_read === 'false' ? false : undefined)); } catch (e) { res.status(500).json({ error: (e as Error).message }); }
  }
  static async markNotificationRead(req: AuthRequest, res: Response) {
    try { await WaSaasNotificationService.markRead(tid(req), req.params.id); res.json({ ok: true }); } catch (e) { res.status(500).json({ error: (e as Error).message }); }
  }
  static async markAllNotificationsRead(req: AuthRequest, res: Response) {
    try { await WaSaasNotificationService.markAllRead(tid(req)); res.json({ ok: true }); } catch (e) { res.status(500).json({ error: (e as Error).message }); }
  }

  // ══════════════════════════════════════════════════════════════════════
  //  MODULE 1: DRIP MARKETING
  // ══════════════════════════════════════════════════════════════════════
  static async listDripCampaigns(req: AuthRequest, res: Response) {
    try { res.json(await DripService.listCampaigns(tid(req))); } catch (e) { res.status(500).json({ error: (e as Error).message }); }
  }
  static async getDripCampaign(req: AuthRequest, res: Response) {
    try { const c = await DripService.getCampaign(tid(req), req.params.id); c ? res.json(c) : res.status(404).json({ error: 'Not found' }); } catch (e) { res.status(500).json({ error: (e as Error).message }); }
  }
  static async createDripCampaign(req: AuthRequest, res: Response) {
    try { const data = CreateDripCampaignSchema.parse(req.body); res.status(201).json(await DripService.createCampaign(tid(req), data)); } catch (e) { res.status(400).json({ error: (e as Error).message }); }
  }
  static async updateDripCampaign(req: AuthRequest, res: Response) {
    try { const data = UpdateDripCampaignSchema.parse(req.body); res.json(await DripService.updateCampaign(tid(req), req.params.id, data)); } catch (e) { res.status(400).json({ error: (e as Error).message }); }
  }
  static async deleteDripCampaign(req: AuthRequest, res: Response) {
    try { await DripService.deleteCampaign(tid(req), req.params.id); res.json({ ok: true }); } catch (e) { res.status(500).json({ error: (e as Error).message }); }
  }
  static async toggleDripCampaign(req: AuthRequest, res: Response) {
    try { res.json(await DripService.toggleCampaign(tid(req), req.params.id)); } catch (e) { res.status(500).json({ error: (e as Error).message }); }
  }
  static async listDripSteps(req: AuthRequest, res: Response) {
    try { res.json(await DripService.listSteps(tid(req), req.params.campaignId)); } catch (e) { res.status(500).json({ error: (e as Error).message }); }
  }
  static async createDripStep(req: AuthRequest, res: Response) {
    try { const data = CreateDripStepSchema.parse(req.body); res.status(201).json(await DripService.createStep(tid(req), data)); } catch (e) { res.status(400).json({ error: (e as Error).message }); }
  }
  static async updateDripStep(req: AuthRequest, res: Response) {
    try { const data = UpdateDripStepSchema.parse(req.body); res.json(await DripService.updateStep(tid(req), req.params.id, data)); } catch (e) { res.status(400).json({ error: (e as Error).message }); }
  }
  static async deleteDripStep(req: AuthRequest, res: Response) {
    try { await DripService.deleteStep(tid(req), req.params.id); res.json({ ok: true }); } catch (e) { res.status(500).json({ error: (e as Error).message }); }
  }
  static async enrollDrip(req: AuthRequest, res: Response) {
    try { const data = EnrollDripSchema.parse(req.body); res.status(201).json(await DripService.enroll(tid(req), data)); } catch (e) { res.status(400).json({ error: (e as Error).message }); }
  }
  static async listDripEnrollments(req: AuthRequest, res: Response) {
    try { res.json(await DripService.listEnrollments(tid(req), req.query.campaign_id as string)); } catch (e) { res.status(500).json({ error: (e as Error).message }); }
  }
  static async getDripStats(req: AuthRequest, res: Response) {
    try { res.json(await DripService.getStats(tid(req))); } catch (e) { res.status(500).json({ error: (e as Error).message }); }
  }

  // ══════════════════════════════════════════════════════════════════════
  //  MODULE 2: AI AUTO-REPLY BOT
  // ══════════════════════════════════════════════════════════════════════
  static async listAiBotConfigs(req: AuthRequest, res: Response) {
    try { res.json(await AiBotService.listConfigs(tid(req))); } catch (e) { res.status(500).json({ error: (e as Error).message }); }
  }
  static async getAiBotConfig(req: AuthRequest, res: Response) {
    try { const c = await AiBotService.getConfig(tid(req), req.params.id); c ? res.json(c) : res.status(404).json({ error: 'Not found' }); } catch (e) { res.status(500).json({ error: (e as Error).message }); }
  }
  static async createAiBotConfig(req: AuthRequest, res: Response) {
    try { const data = CreateAiBotConfigSchema.parse(req.body); res.status(201).json(await AiBotService.createConfig(tid(req), data)); } catch (e) { res.status(400).json({ error: (e as Error).message }); }
  }
  static async updateAiBotConfig(req: AuthRequest, res: Response) {
    try { const data = UpdateAiBotConfigSchema.parse(req.body); res.json(await AiBotService.updateConfig(tid(req), req.params.id, data)); } catch (e) { res.status(400).json({ error: (e as Error).message }); }
  }
  static async deleteAiBotConfig(req: AuthRequest, res: Response) {
    try { await AiBotService.deleteConfig(tid(req), req.params.id); res.json({ ok: true }); } catch (e) { res.status(500).json({ error: (e as Error).message }); }
  }
  static async toggleAiBotConfig(req: AuthRequest, res: Response) {
    try { res.json(await AiBotService.toggleConfig(tid(req), req.params.id)); } catch (e) { res.status(500).json({ error: (e as Error).message }); }
  }
  static async listFaqs(req: AuthRequest, res: Response) {
    try { res.json(await AiBotService.listFaqs(tid(req), req.query.bot_id as string)); } catch (e) { res.status(500).json({ error: (e as Error).message }); }
  }
  static async createFaq(req: AuthRequest, res: Response) {
    try { const data = CreateFaqEntrySchema.parse(req.body); res.status(201).json(await AiBotService.createFaq(tid(req), data)); } catch (e) { res.status(400).json({ error: (e as Error).message }); }
  }
  static async updateFaq(req: AuthRequest, res: Response) {
    try { const data = UpdateFaqEntrySchema.parse(req.body); res.json(await AiBotService.updateFaq(tid(req), req.params.id, data)); } catch (e) { res.status(400).json({ error: (e as Error).message }); }
  }
  static async deleteFaq(req: AuthRequest, res: Response) {
    try { await AiBotService.deleteFaq(tid(req), req.params.id); res.json({ ok: true }); } catch (e) { res.status(500).json({ error: (e as Error).message }); }
  }
  static async listAiConversations(req: AuthRequest, res: Response) {
    try { res.json(await AiBotService.listConversations(tid(req), req.query.bot_id as string, req.query.status as string)); } catch (e) { res.status(500).json({ error: (e as Error).message }); }
  }
  static async getAiConversation(req: AuthRequest, res: Response) {
    try { const c = await AiBotService.getConversation(tid(req), req.params.id); c ? res.json(c) : res.status(404).json({ error: 'Not found' }); } catch (e) { res.status(500).json({ error: (e as Error).message }); }
  }
  static async aiConversationAction(req: AuthRequest, res: Response) {
    try { const data = AiConversationActionSchema.parse(req.body); res.json(await AiBotService.conversationAction(tid(req), req.params.id, data.action, data.agent_id)); } catch (e) { res.status(400).json({ error: (e as Error).message }); }
  }
  static async listAiSuggestions(req: AuthRequest, res: Response) {
    try { res.json(await AiBotService.listSuggestions(tid(req), req.params.conversationId)); } catch (e) { res.status(500).json({ error: (e as Error).message }); }
  }
  static async getAiStats(req: AuthRequest, res: Response) {
    try { res.json(await AiBotService.getStats(tid(req))); } catch (e) { res.status(500).json({ error: (e as Error).message }); }
  }

  // ══════════════════════════════════════════════════════════════════════
  //  MODULE 3: ORDER TRACKING
  // ══════════════════════════════════════════════════════════════════════
  static async listOrderConfigs(req: AuthRequest, res: Response) {
    try { res.json(await OrderTrackingService.listConfigs(tid(req))); } catch (e) { res.status(500).json({ error: (e as Error).message }); }
  }
  static async createOrderConfig(req: AuthRequest, res: Response) {
    try { const data = CreateOrderConfigSchema.parse(req.body); res.status(201).json(await OrderTrackingService.createConfig(tid(req), data)); } catch (e) { res.status(400).json({ error: (e as Error).message }); }
  }
  static async updateOrderConfig(req: AuthRequest, res: Response) {
    try { const data = UpdateOrderConfigSchema.parse(req.body); res.json(await OrderTrackingService.updateConfig(tid(req), req.params.id, data)); } catch (e) { res.status(400).json({ error: (e as Error).message }); }
  }
  static async deleteOrderConfig(req: AuthRequest, res: Response) {
    try { await OrderTrackingService.deleteConfig(tid(req), req.params.id); res.json({ ok: true }); } catch (e) { res.status(500).json({ error: (e as Error).message }); }
  }
  static async listOrders(req: AuthRequest, res: Response) {
    try { res.json(await OrderTrackingService.listOrders(tid(req), req.query.status as string)); } catch (e) { res.status(500).json({ error: (e as Error).message }); }
  }
  static async getOrder(req: AuthRequest, res: Response) {
    try { const o = await OrderTrackingService.getOrder(tid(req), req.params.id); o ? res.json(o) : res.status(404).json({ error: 'Not found' }); } catch (e) { res.status(500).json({ error: (e as Error).message }); }
  }
  static async createOrder(req: AuthRequest, res: Response) {
    try { const data = CreateOrderSchema.parse(req.body); res.status(201).json(await OrderTrackingService.createOrder(tid(req), data)); } catch (e) { res.status(400).json({ error: (e as Error).message }); }
  }
  static async updateOrder(req: AuthRequest, res: Response) {
    try { const data = UpdateOrderSchema.parse(req.body); res.json(await OrderTrackingService.updateOrder(tid(req), req.params.id, data)); } catch (e) { res.status(400).json({ error: (e as Error).message }); }
  }
  static async addOrderEvent(req: AuthRequest, res: Response) {
    try { const data = CreateOrderEventSchema.parse(req.body); res.status(201).json(await OrderTrackingService.addEvent(tid(req), data)); } catch (e) { res.status(400).json({ error: (e as Error).message }); }
  }
  static async listOrderEvents(req: AuthRequest, res: Response) {
    try { res.json(await OrderTrackingService.listEvents(tid(req), req.params.orderId)); } catch (e) { res.status(500).json({ error: (e as Error).message }); }
  }
  static async getOrderStats(req: AuthRequest, res: Response) {
    try { res.json(await OrderTrackingService.getStats(tid(req))); } catch (e) { res.status(500).json({ error: (e as Error).message }); }
  }

  // ══════════════════════════════════════════════════════════════════════
  //  MODULE 4: SUBSCRIPTION BOT
  // ══════════════════════════════════════════════════════════════════════
  static async listSubPlans(req: AuthRequest, res: Response) {
    try { res.json(await SubscriptionBotService.listPlans(tid(req))); } catch (e) { res.status(500).json({ error: (e as Error).message }); }
  }
  static async createSubPlan(req: AuthRequest, res: Response) {
    try { const data = CreateSubPlanSchema.parse(req.body); res.status(201).json(await SubscriptionBotService.createPlan(tid(req), data)); } catch (e) { res.status(400).json({ error: (e as Error).message }); }
  }
  static async updateSubPlan(req: AuthRequest, res: Response) {
    try { const data = UpdateSubPlanSchema.parse(req.body); res.json(await SubscriptionBotService.updatePlan(tid(req), req.params.id, data)); } catch (e) { res.status(400).json({ error: (e as Error).message }); }
  }
  static async deleteSubPlan(req: AuthRequest, res: Response) {
    try { await SubscriptionBotService.deletePlan(tid(req), req.params.id); res.json({ ok: true }); } catch (e) { res.status(500).json({ error: (e as Error).message }); }
  }
  static async listSubscriptions(req: AuthRequest, res: Response) {
    try { res.json(await SubscriptionBotService.listSubscriptions(tid(req), req.query.plan_id as string, req.query.status as string)); } catch (e) { res.status(500).json({ error: (e as Error).message }); }
  }
  static async createSubscription(req: AuthRequest, res: Response) {
    try { const data = CreateSubscriptionSchema.parse(req.body); res.status(201).json(await SubscriptionBotService.createSubscription(tid(req), data)); } catch (e) { res.status(400).json({ error: (e as Error).message }); }
  }
  static async subscriptionAction(req: AuthRequest, res: Response) {
    try { const data = SubscriptionActionSchema.parse(req.body); res.json(await SubscriptionBotService.subscriptionAction(tid(req), req.params.id, data.action)); } catch (e) { res.status(400).json({ error: (e as Error).message }); }
  }
  static async recordSubPayment(req: AuthRequest, res: Response) {
    try { const data = RecordSubPaymentSchema.parse(req.body); res.status(201).json(await SubscriptionBotService.recordPayment(tid(req), data)); } catch (e) { res.status(400).json({ error: (e as Error).message }); }
  }
  static async getSubStats(req: AuthRequest, res: Response) {
    try { res.json(await SubscriptionBotService.getStats(tid(req))); } catch (e) { res.status(500).json({ error: (e as Error).message }); }
  }

  // ══════════════════════════════════════════════════════════════════════
  //  MODULE 5: FLASH SALE
  // ══════════════════════════════════════════════════════════════════════
  static async listFlashSales(req: AuthRequest, res: Response) {
    try { res.json(await FlashSaleService.list(tid(req))); } catch (e) { res.status(500).json({ error: (e as Error).message }); }
  }
  static async getFlashSale(req: AuthRequest, res: Response) {
    try { const s = await FlashSaleService.get(tid(req), req.params.id); s ? res.json(s) : res.status(404).json({ error: 'Not found' }); } catch (e) { res.status(500).json({ error: (e as Error).message }); }
  }
  static async createFlashSale(req: AuthRequest, res: Response) {
    try { const data = CreateFlashSaleSchema.parse(req.body); res.status(201).json(await FlashSaleService.create(tid(req), data)); } catch (e) { res.status(400).json({ error: (e as Error).message }); }
  }
  static async updateFlashSale(req: AuthRequest, res: Response) {
    try { const data = UpdateFlashSaleSchema.parse(req.body); res.json(await FlashSaleService.update(tid(req), req.params.id, data)); } catch (e) { res.status(400).json({ error: (e as Error).message }); }
  }
  static async deleteFlashSale(req: AuthRequest, res: Response) {
    try { await FlashSaleService.delete(tid(req), req.params.id); res.json({ ok: true }); } catch (e) { res.status(500).json({ error: (e as Error).message }); }
  }
  static async flashSaleAction(req: AuthRequest, res: Response) {
    try { const data = FlashSaleActionSchema.parse(req.body); res.json(await FlashSaleService.action(tid(req), req.params.id, data.action)); } catch (e) { res.status(400).json({ error: (e as Error).message }); }
  }
  static async listFlashSaleRecipients(req: AuthRequest, res: Response) {
    try { res.json(await FlashSaleService.listRecipients(tid(req), req.params.saleId)); } catch (e) { res.status(500).json({ error: (e as Error).message }); }
  }
  static async getFlashSaleStats(req: AuthRequest, res: Response) {
    try { res.json(await FlashSaleService.getStats(tid(req))); } catch (e) { res.status(500).json({ error: (e as Error).message }); }
  }

  // ══════════════════════════════════════════════════════════════════════
  //  MODULE 6: TEAM INBOX
  // ══════════════════════════════════════════════════════════════════════
  static async listAgents(req: AuthRequest, res: Response) {
    try { res.json(await TeamInboxService.listAgents(tid(req))); } catch (e) { res.status(500).json({ error: (e as Error).message }); }
  }
  static async createAgent(req: AuthRequest, res: Response) {
    try { const data = CreateAgentSchema.parse(req.body); res.status(201).json(await TeamInboxService.createAgent(tid(req), data)); } catch (e) { res.status(400).json({ error: (e as Error).message }); }
  }
  static async updateAgent(req: AuthRequest, res: Response) {
    try { const data = UpdateAgentSchema.parse(req.body); res.json(await TeamInboxService.updateAgent(tid(req), req.params.id, data)); } catch (e) { res.status(400).json({ error: (e as Error).message }); }
  }
  static async deleteAgent(req: AuthRequest, res: Response) {
    try { await TeamInboxService.deleteAgent(tid(req), req.params.id); res.json({ ok: true }); } catch (e) { res.status(500).json({ error: (e as Error).message }); }
  }
  static async setAgentOnline(req: AuthRequest, res: Response) {
    try { await TeamInboxService.setAgentOnline(tid(req), req.params.id, req.body.online); res.json({ ok: true }); } catch (e) { res.status(500).json({ error: (e as Error).message }); }
  }
  static async listTeamConversations(req: AuthRequest, res: Response) {
    try { res.json(await TeamInboxService.listConversations(tid(req), req.query.status as string, req.query.agent_id as string)); } catch (e) { res.status(500).json({ error: (e as Error).message }); }
  }
  static async getTeamConversation(req: AuthRequest, res: Response) {
    try { const c = await TeamInboxService.getConversation(tid(req), req.params.id); c ? res.json(c) : res.status(404).json({ error: 'Not found' }); } catch (e) { res.status(500).json({ error: (e as Error).message }); }
  }
  static async assignConversation(req: AuthRequest, res: Response) {
    try { const data = AssignConversationSchema.parse(req.body); res.json(await TeamInboxService.assignConversation(tid(req), req.params.id, data.agent_id, data.priority)); } catch (e) { res.status(400).json({ error: (e as Error).message }); }
  }
  static async addConversationTags(req: AuthRequest, res: Response) {
    try { const data = AddTagsSchema.parse(req.body); res.json(await TeamInboxService.addTags(tid(req), req.params.id, data.tags)); } catch (e) { res.status(400).json({ error: (e as Error).message }); }
  }
  static async resolveConversation(req: AuthRequest, res: Response) {
    try { res.json(await TeamInboxService.resolveConversation(tid(req), req.params.id)); } catch (e) { res.status(500).json({ error: (e as Error).message }); }
  }
  static async listTeamMessages(req: AuthRequest, res: Response) {
    try { res.json(await TeamInboxService.listMessages(tid(req), req.params.conversationId)); } catch (e) { res.status(500).json({ error: (e as Error).message }); }
  }
  static async sendTeamReply(req: AuthRequest, res: Response) {
    try { const data = TeamReplySchema.parse(req.body); res.status(201).json(await TeamInboxService.sendReply(tid(req), { ...data, agent_id: req.userId })); } catch (e) { res.status(400).json({ error: (e as Error).message }); }
  }
  static async listTeamNotes(req: AuthRequest, res: Response) {
    try { res.json(await TeamInboxService.listNotes(tid(req), req.params.conversationId)); } catch (e) { res.status(500).json({ error: (e as Error).message }); }
  }
  static async addTeamNote(req: AuthRequest, res: Response) {
    try { const data = CreateNoteSchema.parse(req.body); res.status(201).json(await TeamInboxService.addNote(tid(req), { ...data, agent_id: req.userId })); } catch (e) { res.status(400).json({ error: (e as Error).message }); }
  }
  static async getTeamStats(req: AuthRequest, res: Response) {
    try { res.json(await TeamInboxService.getStats(tid(req))); } catch (e) { res.status(500).json({ error: (e as Error).message }); }
  }

  // ══════════════════════════════════════════════════════════════════════
  //  MODULE 7: LINK TRACKING
  // ══════════════════════════════════════════════════════════════════════
  static async listLinks(req: AuthRequest, res: Response) {
    try { res.json(await LinkTrackingService.list(tid(req))); } catch (e) { res.status(500).json({ error: (e as Error).message }); }
  }
  static async getLink(req: AuthRequest, res: Response) {
    try { const l = await LinkTrackingService.get(tid(req), req.params.id); l ? res.json(l) : res.status(404).json({ error: 'Not found' }); } catch (e) { res.status(500).json({ error: (e as Error).message }); }
  }
  static async createLink(req: AuthRequest, res: Response) {
    try { const data = CreateTrackedLinkSchema.parse(req.body); res.status(201).json(await LinkTrackingService.create(tid(req), data)); } catch (e) { res.status(400).json({ error: (e as Error).message }); }
  }
  static async updateLink(req: AuthRequest, res: Response) {
    try { const data = UpdateTrackedLinkSchema.parse(req.body); res.json(await LinkTrackingService.update(tid(req), req.params.id, data)); } catch (e) { res.status(400).json({ error: (e as Error).message }); }
  }
  static async deleteLink(req: AuthRequest, res: Response) {
    try { await LinkTrackingService.delete(tid(req), req.params.id); res.json({ ok: true }); } catch (e) { res.status(500).json({ error: (e as Error).message }); }
  }
  static async getLinkClickStats(req: AuthRequest, res: Response) {
    try { res.json(await LinkTrackingService.getClickStats(tid(req), req.params.id)); } catch (e) { res.status(500).json({ error: (e as Error).message }); }
  }
  static async recordConversion(req: AuthRequest, res: Response) {
    try { const data = RecordConversionSchema.parse(req.body); await LinkTrackingService.recordConversion(tid(req), data.link_id, data.contact_phone, data.conversion_value); res.json({ ok: true }); } catch (e) { res.status(400).json({ error: (e as Error).message }); }
  }
  static async getLinkStats(req: AuthRequest, res: Response) {
    try { res.json(await LinkTrackingService.getStats(tid(req))); } catch (e) { res.status(500).json({ error: (e as Error).message }); }
  }
  // Public redirect
  static async redirectLink(req: AuthRequest, res: Response) {
    try {
      const link = await LinkTrackingService.resolveShortCode(req.params.code);
      if (!link) { res.status(404).json({ error: 'Link not found' }); return; }
      await LinkTrackingService.recordClick(link.tenant_id, link.id, { contact_phone: req.query.p, ip_address: req.ip, user_agent: req.get('user-agent'), referer: req.get('referer') });
      res.redirect(302, link.original_url);
    } catch (e) { res.status(500).json({ error: (e as Error).message }); }
  }

  // ══════════════════════════════════════════════════════════════════════
  //  MODULE 8: RE-ENGAGEMENT
  // ══════════════════════════════════════════════════════════════════════
  static async listReengagements(req: AuthRequest, res: Response) {
    try { res.json(await ReengagementService.list(tid(req))); } catch (e) { res.status(500).json({ error: (e as Error).message }); }
  }
  static async getReengagement(req: AuthRequest, res: Response) {
    try { const r = await ReengagementService.get(tid(req), req.params.id); r ? res.json(r) : res.status(404).json({ error: 'Not found' }); } catch (e) { res.status(500).json({ error: (e as Error).message }); }
  }
  static async createReengagement(req: AuthRequest, res: Response) {
    try { const data = CreateReengagementSchema.parse(req.body); res.status(201).json(await ReengagementService.create(tid(req), data)); } catch (e) { res.status(400).json({ error: (e as Error).message }); }
  }
  static async updateReengagement(req: AuthRequest, res: Response) {
    try { const data = UpdateReengagementSchema.parse(req.body); res.json(await ReengagementService.update(tid(req), req.params.id, data)); } catch (e) { res.status(400).json({ error: (e as Error).message }); }
  }
  static async deleteReengagement(req: AuthRequest, res: Response) {
    try { await ReengagementService.delete(tid(req), req.params.id); res.json({ ok: true }); } catch (e) { res.status(500).json({ error: (e as Error).message }); }
  }
  static async reengagementAction(req: AuthRequest, res: Response) {
    try { const data = ReengagementActionSchema.parse(req.body); res.json(await ReengagementService.action(tid(req), req.params.id, data.action)); } catch (e) { res.status(400).json({ error: (e as Error).message }); }
  }
  static async listReengagementContacts(req: AuthRequest, res: Response) {
    try { res.json(await ReengagementService.listContacts(tid(req), req.params.campaignId)); } catch (e) { res.status(500).json({ error: (e as Error).message }); }
  }
  static async getReengagementStats(req: AuthRequest, res: Response) {
    try { res.json(await ReengagementService.getStats(tid(req))); } catch (e) { res.status(500).json({ error: (e as Error).message }); }
  }

  // ══════════════════════════════════════════════════════════════════════
  //  MODULE 9: BROADCAST OPTIMIZER
  // ══════════════════════════════════════════════════════════════════════
  static async listBroadcastConfigs(req: AuthRequest, res: Response) {
    try { res.json(await BroadcastOptimizerService.listConfigs(tid(req))); } catch (e) { res.status(500).json({ error: (e as Error).message }); }
  }
  static async createBroadcastConfig(req: AuthRequest, res: Response) {
    try { const data = CreateBroadcastOptimizerSchema.parse(req.body); res.status(201).json(await BroadcastOptimizerService.createConfig(tid(req), data)); } catch (e) { res.status(400).json({ error: (e as Error).message }); }
  }
  static async updateBroadcastConfig(req: AuthRequest, res: Response) {
    try { const data = UpdateBroadcastOptimizerSchema.parse(req.body); res.json(await BroadcastOptimizerService.updateConfig(tid(req), req.params.id, data)); } catch (e) { res.status(400).json({ error: (e as Error).message }); }
  }
  static async deleteBroadcastConfig(req: AuthRequest, res: Response) {
    try { await BroadcastOptimizerService.deleteConfig(tid(req), req.params.id); res.json({ ok: true }); } catch (e) { res.status(500).json({ error: (e as Error).message }); }
  }
  static async listBroadcastBatches(req: AuthRequest, res: Response) {
    try { res.json(await BroadcastOptimizerService.listBatches(tid(req), req.query.status as string)); } catch (e) { res.status(500).json({ error: (e as Error).message }); }
  }
  static async createBroadcastBatch(req: AuthRequest, res: Response) {
    try { const data = CreateBroadcastBatchSchema.parse(req.body); res.status(201).json(await BroadcastOptimizerService.createBatch(tid(req), data)); } catch (e) { res.status(400).json({ error: (e as Error).message }); }
  }
  static async updateBroadcastBatch(req: AuthRequest, res: Response) {
    try { const data = UpdateBroadcastBatchSchema.parse(req.body); res.json(await BroadcastOptimizerService.updateBatch(tid(req), req.params.id, data)); } catch (e) { res.status(400).json({ error: (e as Error).message }); }
  }
  static async deleteBroadcastBatch(req: AuthRequest, res: Response) {
    try { await BroadcastOptimizerService.deleteBatch(tid(req), req.params.id); res.json({ ok: true }); } catch (e) { res.status(500).json({ error: (e as Error).message }); }
  }
  static async getBroadcastStats(req: AuthRequest, res: Response) {
    try { res.json(await BroadcastOptimizerService.getStats(tid(req))); } catch (e) { res.status(500).json({ error: (e as Error).message }); }
  }

  // ══════════════════════════════════════════════════════════════════════
  //  MODULE 10: DIGITAL BUSINESS CARD BOT
  // ══════════════════════════════════════════════════════════════════════
  static async listBusinessCards(req: AuthRequest, res: Response) {
    try { res.json(await BusinessCardService.list(tid(req))); } catch (e) { res.status(500).json({ error: (e as Error).message }); }
  }
  static async getBusinessCard(req: AuthRequest, res: Response) {
    try { const c = await BusinessCardService.get(tid(req), req.params.id); c ? res.json(c) : res.status(404).json({ error: 'Not found' }); } catch (e) { res.status(500).json({ error: (e as Error).message }); }
  }
  static async createBusinessCard(req: AuthRequest, res: Response) {
    try { const data = CreateBusinessCardSchema.parse(req.body); res.status(201).json(await BusinessCardService.create(tid(req), data)); } catch (e) { res.status(400).json({ error: (e as Error).message }); }
  }
  static async updateBusinessCard(req: AuthRequest, res: Response) {
    try { const data = UpdateBusinessCardSchema.parse(req.body); res.json(await BusinessCardService.update(tid(req), req.params.id, data)); } catch (e) { res.status(400).json({ error: (e as Error).message }); }
  }
  static async deleteBusinessCard(req: AuthRequest, res: Response) {
    try { await BusinessCardService.delete(tid(req), req.params.id); res.json({ ok: true }); } catch (e) { res.status(500).json({ error: (e as Error).message }); }
  }
  static async toggleBusinessCard(req: AuthRequest, res: Response) {
    try { res.json(await BusinessCardService.toggle(tid(req), req.params.id)); } catch (e) { res.status(500).json({ error: (e as Error).message }); }
  }
  static async captureBusinessCardLead(req: AuthRequest, res: Response) {
    try { const data = BusinessCardLeadSchema.parse(req.body); res.status(201).json(await BusinessCardService.captureLead(tid(req), data)); } catch (e) { res.status(400).json({ error: (e as Error).message }); }
  }
  static async listBusinessCardLeads(req: AuthRequest, res: Response) {
    try { res.json(await BusinessCardService.listLeads(tid(req), req.query.card_id as string)); } catch (e) { res.status(500).json({ error: (e as Error).message }); }
  }
  static async getBusinessCardStats(req: AuthRequest, res: Response) {
    try { res.json(await BusinessCardService.getStats(tid(req))); } catch (e) { res.status(500).json({ error: (e as Error).message }); }
  }
}
