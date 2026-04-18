import { Router } from 'express';
import { InstagramController } from './instagram.controller';
import { authenticate } from '../../../packages/utils/src/auth.middleware';
import { verifyMetaWebhookSignature } from '../../../packages/utils/src/webhook-verify';

const router = Router();

// ── Accounts ────────────────────────────────────────────────────────────────
router.post('/accounts', authenticate, InstagramController.connectAccount as never);
router.get('/accounts', authenticate, InstagramController.listAccounts as never);
router.get('/accounts/:id', authenticate, InstagramController.getAccount as never);
router.patch('/accounts/:id', authenticate, InstagramController.updateAccount as never);
router.delete('/accounts/:id', authenticate, InstagramController.deleteAccount as never);

// ── DM Inbox ────────────────────────────────────────────────────────────────
router.get('/accounts/:accountId/conversations', authenticate, InstagramController.listConversations as never);
router.get('/accounts/:accountId/conversations/:senderId', authenticate, InstagramController.getConversation as never);
router.post('/accounts/:accountId/conversations/:senderId/read', authenticate, InstagramController.markConversationRead as never);
router.post('/accounts/:accountId/dm/:recipientId', authenticate, InstagramController.sendDM as never);

// ── Comments ────────────────────────────────────────────────────────────────
router.get('/comments', authenticate, InstagramController.listComments as never);

// ── Comment Rules ───────────────────────────────────────────────────────────
router.post('/comment-rules', authenticate, InstagramController.createCommentRule as never);
router.get('/comment-rules', authenticate, InstagramController.listCommentRules as never);
router.get('/comment-rules/:id', authenticate, InstagramController.getCommentRule as never);
router.patch('/comment-rules/:id', authenticate, InstagramController.updateCommentRule as never);
router.delete('/comment-rules/:id', authenticate, InstagramController.deleteCommentRule as never);

// ── Story Rules ─────────────────────────────────────────────────────────────
router.post('/story-rules', authenticate, InstagramController.createStoryRule as never);
router.get('/story-rules', authenticate, InstagramController.listStoryRules as never);
router.get('/story-rules/:id', authenticate, InstagramController.getStoryRule as never);
router.patch('/story-rules/:id', authenticate, InstagramController.updateStoryRule as never);
router.delete('/story-rules/:id', authenticate, InstagramController.deleteStoryRule as never);

// ── Lead Bot Config ─────────────────────────────────────────────────────────
router.post('/lead-bot', authenticate, InstagramController.createLeadBotConfig as never);
router.get('/lead-bot', authenticate, InstagramController.listLeadBotConfigs as never);
router.get('/lead-bot/:id', authenticate, InstagramController.getLeadBotConfig as never);
router.patch('/lead-bot/:id', authenticate, InstagramController.updateLeadBotConfig as never);
router.delete('/lead-bot/:id', authenticate, InstagramController.deleteLeadBotConfig as never);

// ── Leads ───────────────────────────────────────────────────────────────────
router.get('/leads', authenticate, InstagramController.listLeads as never);
router.get('/leads/:id', authenticate, InstagramController.getLead as never);

// ── Content Studio ──────────────────────────────────────────────────────────
router.post('/content', authenticate, InstagramController.createContent as never);
router.get('/content', authenticate, InstagramController.listContent as never);
router.get('/content/:id', authenticate, InstagramController.getContent as never);
router.patch('/content/:id', authenticate, InstagramController.updateContent as never);
router.delete('/content/:id', authenticate, InstagramController.deleteContent as never);
router.post('/content/:id/publish', authenticate, InstagramController.publishContent as never);

// ── Logs ────────────────────────────────────────────────────────────────────
router.get('/logs', authenticate, InstagramController.listLogs as never);

// ── Stats ───────────────────────────────────────────────────────────────────
router.get('/stats', authenticate, InstagramController.getStats as never);

// ── Click Tracking ──────────────────────────────────────────────────────────
router.post('/track/:ruleId', InstagramController.trackClick as never);

// ── Webhook (public) ────────────────────────────────────────────────────────
router.get('/webhook', InstagramController.verifyWebhook as never);
router.post('/webhook', verifyMetaWebhookSignature, InstagramController.handleWebhook as never);

export default router;
