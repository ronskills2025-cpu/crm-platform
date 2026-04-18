import { Router } from 'express';
import { authenticate, optionalAuth } from '../../../packages/utils/src/auth.middleware';
import { WaSaasController as C } from './wa-saas.controller';

const router = Router();

// ── Dashboard ─────────────────────────────────────────────────────
router.get('/dashboard', authenticate, C.getDashboard as never);

// ── Notifications ─────────────────────────────────────────────────
router.get('/notifications', authenticate, C.listNotifications as never);
router.patch('/notifications/:id/read', authenticate, C.markNotificationRead as never);
router.patch('/notifications/read-all', authenticate, C.markAllNotificationsRead as never);

// ── Drip Marketing ────────────────────────────────────────────────
router.get('/drip/campaigns', authenticate, C.listDripCampaigns as never);
router.get('/drip/campaigns/:id', authenticate, C.getDripCampaign as never);
router.post('/drip/campaigns', authenticate, C.createDripCampaign as never);
router.put('/drip/campaigns/:id', authenticate, C.updateDripCampaign as never);
router.delete('/drip/campaigns/:id', authenticate, C.deleteDripCampaign as never);
router.patch('/drip/campaigns/:id/toggle', authenticate, C.toggleDripCampaign as never);
router.get('/drip/campaigns/:campaignId/steps', authenticate, C.listDripSteps as never);
router.post('/drip/steps', authenticate, C.createDripStep as never);
router.put('/drip/steps/:id', authenticate, C.updateDripStep as never);
router.delete('/drip/steps/:id', authenticate, C.deleteDripStep as never);
router.post('/drip/enroll', authenticate, C.enrollDrip as never);
router.get('/drip/enrollments', authenticate, C.listDripEnrollments as never);
router.get('/drip/stats', authenticate, C.getDripStats as never);

// ── AI Auto-Reply Bot ─────────────────────────────────────────────
router.get('/ai-bot/configs', authenticate, C.listAiBotConfigs as never);
router.get('/ai-bot/configs/:id', authenticate, C.getAiBotConfig as never);
router.post('/ai-bot/configs', authenticate, C.createAiBotConfig as never);
router.put('/ai-bot/configs/:id', authenticate, C.updateAiBotConfig as never);
router.delete('/ai-bot/configs/:id', authenticate, C.deleteAiBotConfig as never);
router.patch('/ai-bot/configs/:id/toggle', authenticate, C.toggleAiBotConfig as never);
router.get('/ai-bot/faqs', authenticate, C.listFaqs as never);
router.post('/ai-bot/faqs', authenticate, C.createFaq as never);
router.put('/ai-bot/faqs/:id', authenticate, C.updateFaq as never);
router.delete('/ai-bot/faqs/:id', authenticate, C.deleteFaq as never);
router.get('/ai-bot/conversations', authenticate, C.listAiConversations as never);
router.get('/ai-bot/conversations/:id', authenticate, C.getAiConversation as never);
router.post('/ai-bot/conversations/:id/action', authenticate, C.aiConversationAction as never);
router.get('/ai-bot/conversations/:conversationId/suggestions', authenticate, C.listAiSuggestions as never);
router.get('/ai-bot/stats', authenticate, C.getAiStats as never);

// ── Order Tracking ────────────────────────────────────────────────
router.get('/orders/configs', authenticate, C.listOrderConfigs as never);
router.post('/orders/configs', authenticate, C.createOrderConfig as never);
router.put('/orders/configs/:id', authenticate, C.updateOrderConfig as never);
router.delete('/orders/configs/:id', authenticate, C.deleteOrderConfig as never);
router.get('/orders', authenticate, C.listOrders as never);
router.get('/orders/:id', authenticate, C.getOrder as never);
router.post('/orders', authenticate, C.createOrder as never);
router.put('/orders/:id', authenticate, C.updateOrder as never);
router.post('/orders/events', authenticate, C.addOrderEvent as never);
router.get('/orders/:orderId/events', authenticate, C.listOrderEvents as never);
router.get('/orders/stats/overview', authenticate, C.getOrderStats as never);

// ── Subscription Bot ──────────────────────────────────────────────
router.get('/subscriptions/plans', authenticate, C.listSubPlans as never);
router.post('/subscriptions/plans', authenticate, C.createSubPlan as never);
router.put('/subscriptions/plans/:id', authenticate, C.updateSubPlan as never);
router.delete('/subscriptions/plans/:id', authenticate, C.deleteSubPlan as never);
router.get('/subscriptions', authenticate, C.listSubscriptions as never);
router.post('/subscriptions', authenticate, C.createSubscription as never);
router.post('/subscriptions/:id/action', authenticate, C.subscriptionAction as never);
router.post('/subscriptions/payments', authenticate, C.recordSubPayment as never);
router.get('/subscriptions/stats', authenticate, C.getSubStats as never);

// ── Flash Sale ────────────────────────────────────────────────────
router.get('/flash-sales', authenticate, C.listFlashSales as never);
router.get('/flash-sales/:id', authenticate, C.getFlashSale as never);
router.post('/flash-sales', authenticate, C.createFlashSale as never);
router.put('/flash-sales/:id', authenticate, C.updateFlashSale as never);
router.delete('/flash-sales/:id', authenticate, C.deleteFlashSale as never);
router.post('/flash-sales/:id/action', authenticate, C.flashSaleAction as never);
router.get('/flash-sales/:saleId/recipients', authenticate, C.listFlashSaleRecipients as never);
router.get('/flash-sales/stats/overview', authenticate, C.getFlashSaleStats as never);

// ── Team Inbox ────────────────────────────────────────────────────
router.get('/team-inbox/agents', authenticate, C.listAgents as never);
router.post('/team-inbox/agents', authenticate, C.createAgent as never);
router.put('/team-inbox/agents/:id', authenticate, C.updateAgent as never);
router.delete('/team-inbox/agents/:id', authenticate, C.deleteAgent as never);
router.patch('/team-inbox/agents/:id/online', authenticate, C.setAgentOnline as never);
router.get('/team-inbox/conversations', authenticate, C.listTeamConversations as never);
router.get('/team-inbox/conversations/:id', authenticate, C.getTeamConversation as never);
router.post('/team-inbox/conversations/:id/assign', authenticate, C.assignConversation as never);
router.post('/team-inbox/conversations/:id/tags', authenticate, C.addConversationTags as never);
router.post('/team-inbox/conversations/:id/resolve', authenticate, C.resolveConversation as never);
router.get('/team-inbox/conversations/:conversationId/messages', authenticate, C.listTeamMessages as never);
router.post('/team-inbox/reply', authenticate, C.sendTeamReply as never);
router.get('/team-inbox/conversations/:conversationId/notes', authenticate, C.listTeamNotes as never);
router.post('/team-inbox/notes', authenticate, C.addTeamNote as never);
router.get('/team-inbox/stats', authenticate, C.getTeamStats as never);

// ── Link Tracking ─────────────────────────────────────────────────
router.get('/links', authenticate, C.listLinks as never);
router.get('/links/:id', authenticate, C.getLink as never);
router.post('/links', authenticate, C.createLink as never);
router.put('/links/:id', authenticate, C.updateLink as never);
router.delete('/links/:id', authenticate, C.deleteLink as never);
router.get('/links/:id/clicks', authenticate, C.getLinkClickStats as never);
router.post('/links/conversions', authenticate, C.recordConversion as never);
router.get('/links/stats/overview', authenticate, C.getLinkStats as never);
// Public redirect
router.get('/l/:code', optionalAuth, C.redirectLink as never);

// ── Re-Engagement ─────────────────────────────────────────────────
router.get('/reengagement', authenticate, C.listReengagements as never);
router.get('/reengagement/:id', authenticate, C.getReengagement as never);
router.post('/reengagement', authenticate, C.createReengagement as never);
router.put('/reengagement/:id', authenticate, C.updateReengagement as never);
router.delete('/reengagement/:id', authenticate, C.deleteReengagement as never);
router.post('/reengagement/:id/action', authenticate, C.reengagementAction as never);
router.get('/reengagement/:campaignId/contacts', authenticate, C.listReengagementContacts as never);
router.get('/reengagement/stats/overview', authenticate, C.getReengagementStats as never);

// ── Broadcast Optimizer ───────────────────────────────────────────
router.get('/broadcast-opt/configs', authenticate, C.listBroadcastConfigs as never);
router.post('/broadcast-opt/configs', authenticate, C.createBroadcastConfig as never);
router.put('/broadcast-opt/configs/:id', authenticate, C.updateBroadcastConfig as never);
router.delete('/broadcast-opt/configs/:id', authenticate, C.deleteBroadcastConfig as never);
router.get('/broadcast-opt/batches', authenticate, C.listBroadcastBatches as never);
router.post('/broadcast-opt/batches', authenticate, C.createBroadcastBatch as never);
router.put('/broadcast-opt/batches/:id', authenticate, C.updateBroadcastBatch as never);
router.delete('/broadcast-opt/batches/:id', authenticate, C.deleteBroadcastBatch as never);
router.get('/broadcast-opt/stats', authenticate, C.getBroadcastStats as never);

// ── Business Card Bot ─────────────────────────────────────────────
router.get('/business-cards', authenticate, C.listBusinessCards as never);
router.get('/business-cards/:id', authenticate, C.getBusinessCard as never);
router.post('/business-cards', authenticate, C.createBusinessCard as never);
router.put('/business-cards/:id', authenticate, C.updateBusinessCard as never);
router.delete('/business-cards/:id', authenticate, C.deleteBusinessCard as never);
router.patch('/business-cards/:id/toggle', authenticate, C.toggleBusinessCard as never);
router.post('/business-cards/leads', authenticate, C.captureBusinessCardLead as never);
router.get('/business-cards/leads/list', authenticate, C.listBusinessCardLeads as never);
router.get('/business-cards/stats', authenticate, C.getBusinessCardStats as never);

export default router;
