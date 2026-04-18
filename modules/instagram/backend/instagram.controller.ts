import { Response } from 'express';
import { z } from 'zod';
import type { AuthRequest } from '../../../packages/utils/src/auth.middleware';
import { config } from '../../../packages/config/src/config';
import { createLogger } from '../../../packages/utils/src/logger';
import { instagramQueue } from '../../../packages/utils/src/queues';
import {
  InstagramAccountService, InstagramMessageService, InstagramCommentService,
  InstagramCommentRuleService, InstagramStoryRuleService,
  InstagramLeadBotService, InstagramLeadService,
  InstagramContentService, InstagramLogService, InstagramStatsService,
} from './instagram.service';
import {
  ConnectInstagramSchema, UpdateInstagramAccountSchema,
  CreateCommentRuleSchema, UpdateCommentRuleSchema,
  CreateStoryRuleSchema, UpdateStoryRuleSchema,
  CreateLeadBotConfigSchema, UpdateLeadBotConfigSchema,
  CreateContentSchema, UpdateContentSchema,
} from './Instagram';

const log = createLogger('ctrl:instagram');

export class InstagramController {
  // ── Accounts ──────────────────────────────────────────────────────────────
  static async connectAccount(req: AuthRequest, res: Response) {
    try {
      const d = ConnectInstagramSchema.parse(req.body);
      const account = await InstagramAccountService.connect(req.tenantId!, {
        ig_user_id: d.igUserId, ig_username: d.igUsername, access_token: d.accessToken,
        token_expires_at: d.tokenExpiresAt, page_id: d.pageId,
        page_access_token: d.pageAccessToken, profile_pic_url: d.profilePicUrl,
        metadata: d.metadata,
      });
      res.status(201).json({ success: true, account });
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors });
      log.error('connectAccount failed', err);
      res.status(500).json({ error: 'Failed to connect account' });
    }
  }

  static async listAccounts(req: AuthRequest, res: Response) {
    try {
      const accounts = await InstagramAccountService.list(req.tenantId!);
      res.json({ success: true, accounts });
    } catch (err) {
      log.error('listAccounts failed', err);
      res.status(500).json({ error: 'Failed to list accounts' });
    }
  }

  static async getAccount(req: AuthRequest, res: Response) {
    try {
      const ac = await InstagramAccountService.getById(req.params.id);
      if (!ac) return res.status(404).json({ error: 'Account not found' });
      res.json({ success: true, account: ac });
    } catch (err) {
      log.error('getAccount failed', err);
      res.status(500).json({ error: 'Failed to get account' });
    }
  }

  static async updateAccount(req: AuthRequest, res: Response) {
    try {
      const d = UpdateInstagramAccountSchema.parse(req.body);
      const account = await InstagramAccountService.update(req.params.id, d);
      if (!account) return res.status(404).json({ error: 'Account not found' });
      res.json({ success: true, account });
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors });
      log.error('updateAccount failed', err);
      res.status(500).json({ error: 'Failed to update account' });
    }
  }

  static async deleteAccount(req: AuthRequest, res: Response) {
    try {
      const ok = await InstagramAccountService.delete(req.params.id);
      if (!ok) return res.status(404).json({ error: 'Account not found' });
      res.json({ success: true });
    } catch (err) {
      log.error('deleteAccount failed', err);
      res.status(500).json({ error: 'Failed to delete account' });
    }
  }

  // ── DM Inbox ──────────────────────────────────────────────────────────────
  static async listConversations(req: AuthRequest, res: Response) {
    try {
      const { accountId } = req.params;
      const result = await InstagramMessageService.listConversations(req.tenantId!, accountId, {
        limit: parseInt(req.query.limit as string) || 50,
        offset: parseInt(req.query.offset as string) || 0,
        search: req.query.search as string,
      });
      res.json({ success: true, ...result });
    } catch (err) {
      log.error('listConversations failed', err);
      res.status(500).json({ error: 'Failed to list conversations' });
    }
  }

  static async getConversation(req: AuthRequest, res: Response) {
    try {
      const messages = await InstagramMessageService.getConversation(req.params.accountId, req.params.senderId, {
        limit: parseInt(req.query.limit as string) || 100,
        offset: parseInt(req.query.offset as string) || 0,
      });
      res.json({ success: true, messages });
    } catch (err) {
      log.error('getConversation failed', err);
      res.status(500).json({ error: 'Failed to get conversation' });
    }
  }

  static async sendDM(req: AuthRequest, res: Response) {
    try {
      const { accountId, recipientId } = req.params;
      const { body } = z.object({ body: z.string().min(1) }).parse(req.body);
      const account = await InstagramAccountService.getById(accountId);
      if (!account) return res.status(404).json({ error: 'Account not found' });

      // instagramQueue imported at top of file
      await instagramQueue.add('send_dm', {
        action: 'send_dm',
        tenantId: req.tenantId!, accountId, recipientId, body,
        accessToken: account.access_token, igUserId: account.ig_user_id,
      });
      res.json({ success: true, queued: true });
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors });
      log.error('sendDM failed', err);
      res.status(500).json({ error: 'Failed to send DM' });
    }
  }

  static async markConversationRead(req: AuthRequest, res: Response) {
    try {
      await InstagramMessageService.markRead(req.params.accountId, req.params.senderId);
      res.json({ success: true });
    } catch (err) {
      log.error('markConversationRead failed', err);
      res.status(500).json({ error: 'Failed to mark read' });
    }
  }

  // ── Comments ──────────────────────────────────────────────────────────────
  static async listComments(req: AuthRequest, res: Response) {
    try {
      const result = await InstagramCommentService.list(req.tenantId!, {
        accountId: req.query.accountId as string,
        igMediaId: req.query.igMediaId as string,
        limit: parseInt(req.query.limit as string) || 100,
        offset: parseInt(req.query.offset as string) || 0,
      });
      res.json({ success: true, ...result });
    } catch (err) {
      log.error('listComments failed', err);
      res.status(500).json({ error: 'Failed to list comments' });
    }
  }

  // ── Comment Rules ─────────────────────────────────────────────────────────
  static async createCommentRule(req: AuthRequest, res: Response) {
    try {
      const d = CreateCommentRuleSchema.parse(req.body);
      const rule = await InstagramCommentRuleService.create(req.tenantId!, d);
      res.status(201).json({ success: true, rule });
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors });
      log.error('createCommentRule failed', err);
      res.status(500).json({ error: 'Failed to create comment rule' });
    }
  }

  static async listCommentRules(req: AuthRequest, res: Response) {
    try {
      const rules = await InstagramCommentRuleService.list(req.tenantId!, {
        accountId: req.query.accountId as string,
      });
      res.json({ success: true, rules });
    } catch (err) {
      log.error('listCommentRules failed', err);
      res.status(500).json({ error: 'Failed to list comment rules' });
    }
  }

  static async getCommentRule(req: AuthRequest, res: Response) {
    try {
      const rule = await InstagramCommentRuleService.getById(req.params.id);
      if (!rule) return res.status(404).json({ error: 'Rule not found' });
      res.json({ success: true, rule });
    } catch (err) {
      log.error('getCommentRule failed', err);
      res.status(500).json({ error: 'Failed to get comment rule' });
    }
  }

  static async updateCommentRule(req: AuthRequest, res: Response) {
    try {
      const d = UpdateCommentRuleSchema.parse(req.body);
      const rule = await InstagramCommentRuleService.update(req.params.id, d);
      if (!rule) return res.status(404).json({ error: 'Rule not found' });
      res.json({ success: true, rule });
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors });
      log.error('updateCommentRule failed', err);
      res.status(500).json({ error: 'Failed to update comment rule' });
    }
  }

  static async deleteCommentRule(req: AuthRequest, res: Response) {
    try {
      const ok = await InstagramCommentRuleService.delete(req.params.id);
      if (!ok) return res.status(404).json({ error: 'Rule not found' });
      res.json({ success: true });
    } catch (err) {
      log.error('deleteCommentRule failed', err);
      res.status(500).json({ error: 'Failed to delete comment rule' });
    }
  }

  // ── Story Rules ───────────────────────────────────────────────────────────
  static async createStoryRule(req: AuthRequest, res: Response) {
    try {
      const d = CreateStoryRuleSchema.parse(req.body);
      const rule = await InstagramStoryRuleService.create(req.tenantId!, d);
      res.status(201).json({ success: true, rule });
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors });
      log.error('createStoryRule failed', err);
      res.status(500).json({ error: 'Failed to create story rule' });
    }
  }

  static async listStoryRules(req: AuthRequest, res: Response) {
    try {
      const rules = await InstagramStoryRuleService.list(req.tenantId!, {
        accountId: req.query.accountId as string,
      });
      res.json({ success: true, rules });
    } catch (err) {
      log.error('listStoryRules failed', err);
      res.status(500).json({ error: 'Failed to list story rules' });
    }
  }

  static async getStoryRule(req: AuthRequest, res: Response) {
    try {
      const rule = await InstagramStoryRuleService.getById(req.params.id);
      if (!rule) return res.status(404).json({ error: 'Rule not found' });
      res.json({ success: true, rule });
    } catch (err) {
      log.error('getStoryRule failed', err);
      res.status(500).json({ error: 'Failed to get story rule' });
    }
  }

  static async updateStoryRule(req: AuthRequest, res: Response) {
    try {
      const d = UpdateStoryRuleSchema.parse(req.body);
      const rule = await InstagramStoryRuleService.update(req.params.id, d);
      if (!rule) return res.status(404).json({ error: 'Rule not found' });
      res.json({ success: true, rule });
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors });
      log.error('updateStoryRule failed', err);
      res.status(500).json({ error: 'Failed to update story rule' });
    }
  }

  static async deleteStoryRule(req: AuthRequest, res: Response) {
    try {
      const ok = await InstagramStoryRuleService.delete(req.params.id);
      if (!ok) return res.status(404).json({ error: 'Rule not found' });
      res.json({ success: true });
    } catch (err) {
      log.error('deleteStoryRule failed', err);
      res.status(500).json({ error: 'Failed to delete story rule' });
    }
  }

  // ── Lead Bot ──────────────────────────────────────────────────────────────
  static async createLeadBotConfig(req: AuthRequest, res: Response) {
    try {
      const d = CreateLeadBotConfigSchema.parse(req.body);
      const config = await InstagramLeadBotService.create(req.tenantId!, d);
      res.status(201).json({ success: true, config });
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors });
      log.error('createLeadBotConfig failed', err);
      res.status(500).json({ error: 'Failed to create lead bot config' });
    }
  }

  static async listLeadBotConfigs(req: AuthRequest, res: Response) {
    try {
      const configs = await InstagramLeadBotService.list(req.tenantId!, {
        accountId: req.query.accountId as string,
      });
      res.json({ success: true, configs });
    } catch (err) {
      log.error('listLeadBotConfigs failed', err);
      res.status(500).json({ error: 'Failed to list lead bot configs' });
    }
  }

  static async getLeadBotConfig(req: AuthRequest, res: Response) {
    try {
      const config = await InstagramLeadBotService.getById(req.params.id);
      if (!config) return res.status(404).json({ error: 'Config not found' });
      res.json({ success: true, config });
    } catch (err) {
      log.error('getLeadBotConfig failed', err);
      res.status(500).json({ error: 'Failed to get lead bot config' });
    }
  }

  static async updateLeadBotConfig(req: AuthRequest, res: Response) {
    try {
      const d = UpdateLeadBotConfigSchema.parse(req.body);
      const config = await InstagramLeadBotService.update(req.params.id, d);
      if (!config) return res.status(404).json({ error: 'Config not found' });
      res.json({ success: true, config });
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors });
      log.error('updateLeadBotConfig failed', err);
      res.status(500).json({ error: 'Failed to update lead bot config' });
    }
  }

  static async deleteLeadBotConfig(req: AuthRequest, res: Response) {
    try {
      const ok = await InstagramLeadBotService.delete(req.params.id);
      if (!ok) return res.status(404).json({ error: 'Config not found' });
      res.json({ success: true });
    } catch (err) {
      log.error('deleteLeadBotConfig failed', err);
      res.status(500).json({ error: 'Failed to delete lead bot config' });
    }
  }

  // ── Leads ─────────────────────────────────────────────────────────────────
  static async listLeads(req: AuthRequest, res: Response) {
    try {
      const result = await InstagramLeadService.list(req.tenantId!, {
        accountId: req.query.accountId as string,
        status: req.query.status as string,
        segment: req.query.segment as string,
        limit: parseInt(req.query.limit as string) || 50,
        offset: parseInt(req.query.offset as string) || 0,
      });
      res.json({ success: true, ...result });
    } catch (err) {
      log.error('listLeads failed', err);
      res.status(500).json({ error: 'Failed to list leads' });
    }
  }

  static async getLead(req: AuthRequest, res: Response) {
    try {
      const lead = await InstagramLeadService.getById(req.params.id);
      if (!lead) return res.status(404).json({ error: 'Lead not found' });
      res.json({ success: true, lead });
    } catch (err) {
      log.error('getLead failed', err);
      res.status(500).json({ error: 'Failed to get lead' });
    }
  }

  // ── Content Studio ────────────────────────────────────────────────────────
  static async createContent(req: AuthRequest, res: Response) {
    try {
      const d = CreateContentSchema.parse(req.body);
      const content = await InstagramContentService.create(req.tenantId!, d);
      if (d.scheduledAt) {
        // instagramQueue imported at top of file
        const delay = new Date(d.scheduledAt).getTime() - Date.now();
        if (delay > 0) {
          await instagramQueue.add('publish_content', { action: 'publish_content', contentId: content.id, tenantId: req.tenantId! }, { delay });
        }
      }
      res.status(201).json({ success: true, content });
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors });
      log.error('createContent failed', err);
      res.status(500).json({ error: 'Failed to create content' });
    }
  }

  static async listContent(req: AuthRequest, res: Response) {
    try {
      const result = await InstagramContentService.list(req.tenantId!, {
        accountId: req.query.accountId as string,
        status: req.query.status as string,
        contentType: req.query.contentType as string,
        limit: parseInt(req.query.limit as string) || 50,
        offset: parseInt(req.query.offset as string) || 0,
      });
      res.json({ success: true, ...result });
    } catch (err) {
      log.error('listContent failed', err);
      res.status(500).json({ error: 'Failed to list content' });
    }
  }

  static async getContent(req: AuthRequest, res: Response) {
    try {
      const content = await InstagramContentService.getById(req.params.id);
      if (!content) return res.status(404).json({ error: 'Content not found' });
      res.json({ success: true, content });
    } catch (err) {
      log.error('getContent failed', err);
      res.status(500).json({ error: 'Failed to get content' });
    }
  }

  static async updateContent(req: AuthRequest, res: Response) {
    try {
      const d = UpdateContentSchema.parse(req.body);
      const content = await InstagramContentService.update(req.params.id, d);
      if (!content) return res.status(404).json({ error: 'Content not found' });
      res.json({ success: true, content });
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors });
      log.error('updateContent failed', err);
      res.status(500).json({ error: 'Failed to update content' });
    }
  }

  static async deleteContent(req: AuthRequest, res: Response) {
    try {
      const ok = await InstagramContentService.delete(req.params.id);
      if (!ok) return res.status(404).json({ error: 'Content not found' });
      res.json({ success: true });
    } catch (err) {
      log.error('deleteContent failed', err);
      res.status(500).json({ error: 'Failed to delete content' });
    }
  }

  static async publishContent(req: AuthRequest, res: Response) {
    try {
      // instagramQueue imported at top of file
      await instagramQueue.add('publish_content', {
        action: 'publish_content', contentId: req.params.id, tenantId: req.tenantId!,
      });
      res.json({ success: true, queued: true });
    } catch (err) {
      log.error('publishContent failed', err);
      res.status(500).json({ error: 'Failed to queue content publish' });
    }
  }

  // ── Logs ──────────────────────────────────────────────────────────────────
  static async listLogs(req: AuthRequest, res: Response) {
    try {
      const result = await InstagramLogService.list(req.tenantId!, {
        logType: req.query.logType as string,
        ruleId: req.query.ruleId as string,
        limit: parseInt(req.query.limit as string) || 100,
        offset: parseInt(req.query.offset as string) || 0,
      });
      res.json({ success: true, ...result });
    } catch (err) {
      log.error('listLogs failed', err);
      res.status(500).json({ error: 'Failed to list logs' });
    }
  }

  // ── Stats ─────────────────────────────────────────────────────────────────
  static async getStats(req: AuthRequest, res: Response) {
    try {
      const stats = await InstagramStatsService.getOverview(req.tenantId!);
      res.json({ success: true, stats });
    } catch (err) {
      log.error('getStats failed', err);
      res.status(500).json({ error: 'Failed to get stats' });
    }
  }

  // ── Webhook (public) ─────────────────────────────────────────────────────
  static async handleWebhook(req: AuthRequest, res: Response) {
    try {
      // instagramQueue imported at top of file
      await instagramQueue.add('process_webhook', { action: 'process_webhook', payload: req.body });
      res.json({ success: true });
    } catch (err) {
      log.error('handleWebhook failed', err);
      res.status(500).json({ error: 'Webhook processing failed' });
    }
  }

  static async verifyWebhook(req: AuthRequest, res: Response) {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];
    if (mode === 'subscribe' && token === config.instagram.verifyToken) {
      res.status(200).send(challenge);
    } else {
      res.sendStatus(403);
    }
  }

  // ── Click Tracking ────────────────────────────────────────────────────────
  static async trackClick(req: AuthRequest, res: Response) {
    try {
      const ruleId = req.params.ruleId;
      await InstagramCommentRuleService.incrementClick(ruleId);
      await InstagramLogService.log({
        tenant_id: req.tenantId ?? 'unknown',
        log_type: 'comment_dm',
        rule_id: ruleId,
        message: 'Link clicked',
        status: 'success',
      });
      res.json({ success: true });
    } catch (err) {
      log.error('trackClick failed', err);
      res.status(500).json({ error: 'Failed to track click' });
    }
  }
}
