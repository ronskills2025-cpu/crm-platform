import type { RequestHandler } from 'express';
import { AutomationService } from './automation.service';
import {
  CreateAutomationRuleSchema, UpdateAutomationRuleSchema,
  CreateScheduledCampaignSchema, UpdateScheduledCampaignSchema,
} from './AutomationRule';
import { z } from 'zod';
import type { AuthRequest } from '../../../packages/utils/src/auth.middleware';

export const AutomationController = {
  // ── Rules ──────────────────────────────────────────────────────────────────
  listRules: (async (req: AuthRequest, res) => {
    try {
      const rules = await AutomationService.listRules({
        channel: req.query.channel as string | undefined,
        trigger_type: req.query.trigger_type as string | undefined,
        is_active: req.query.is_active !== undefined ? (req.query.is_active as string) === 'true' : undefined,
        tenant_id: req.tenantId,
      });
      res.json({ rules });
    } catch {
      res.status(500).json({ error: 'Failed to list rules' });
    }
  }) as RequestHandler,

  createRule: (async (req: AuthRequest, res) => {
    try {
      const data = CreateAutomationRuleSchema.parse(req.body);
      const rule = await AutomationService.createRule({ ...data, tenant_id: req.tenantId });
      res.status(201).json({ rule });
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors });
      res.status(500).json({ error: 'Failed to create rule' });
    }
  }) as RequestHandler,

  getRule: (async (req: AuthRequest, res) => {
    try {
      const rule = await AutomationService.getRule(req.params.id, req.tenantId);
      if (!rule) return res.status(404).json({ error: 'Rule not found' });
      res.json({ rule });
    } catch {
      res.status(500).json({ error: 'Failed to get rule' });
    }
  }) as RequestHandler,

  updateRule: (async (req, res) => {
    try {
      const data = UpdateAutomationRuleSchema.parse(req.body);
      const rule = await AutomationService.updateRule(req.params.id, data);
      if (!rule) return res.status(404).json({ error: 'Rule not found' });
      res.json({ rule });
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors });
      res.status(500).json({ error: 'Failed to update rule' });
    }
  }) as RequestHandler,

  deleteRule: (async (req, res) => {
    try {
      const deleted = await AutomationService.deleteRule(req.params.id);
      if (!deleted) return res.status(404).json({ error: 'Rule not found' });
      res.json({ success: true });
    } catch {
      res.status(500).json({ error: 'Failed to delete rule' });
    }
  }) as RequestHandler,

  toggleRule: (async (req, res) => {
    try {
      const rule = await AutomationService.toggleRule(req.params.id);
      if (!rule) return res.status(404).json({ error: 'Rule not found' });
      res.json({ rule });
    } catch {
      res.status(500).json({ error: 'Failed to toggle rule' });
    }
  }) as RequestHandler,

  getLogs: (async (req, res) => {
    try {
      const logs = await AutomationService.getLogs({
        rule_id: req.query.rule_id as string | undefined,
        limit: req.query.limit ? Number(req.query.limit) : 50,
        offset: req.query.offset ? Number(req.query.offset) : 0,
      });
      res.json({ logs });
    } catch {
      res.status(500).json({ error: 'Failed to get logs' });
    }
  }) as RequestHandler,

  // ── Scheduled Campaigns ───────────────────────────────────────────────────
  listScheduled: (async (req, res) => {
    try {
      const campaigns = await AutomationService.listScheduledCampaigns({
        channel: req.query.channel as string | undefined,
        status: req.query.status as string | undefined,
      });
      res.json({ campaigns });
    } catch {
      res.status(500).json({ error: 'Failed to list scheduled campaigns' });
    }
  }) as RequestHandler,

  createScheduled: (async (req, res) => {
    try {
      const data = CreateScheduledCampaignSchema.parse(req.body);
      const campaign = await AutomationService.createScheduledCampaign(data);
      res.status(201).json({ campaign });
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors });
      res.status(500).json({ error: 'Failed to create scheduled campaign' });
    }
  }) as RequestHandler,

  updateScheduled: (async (req, res) => {
    try {
      const data = UpdateScheduledCampaignSchema.parse(req.body);
      const campaign = await AutomationService.updateScheduledCampaign(req.params.id, data);
      if (!campaign) return res.status(404).json({ error: 'Campaign not found' });
      res.json({ campaign });
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors });
      res.status(500).json({ error: 'Failed to update campaign' });
    }
  }) as RequestHandler,

  cancelScheduled: (async (req, res) => {
    try {
      const campaign = await AutomationService.cancelScheduledCampaign(req.params.id);
      if (!campaign) return res.status(404).json({ error: 'Campaign not found or already running' });
      res.json({ campaign });
    } catch {
      res.status(500).json({ error: 'Failed to cancel campaign' });
    }
  }) as RequestHandler,

  deleteScheduled: (async (req, res) => {
    try {
      const deleted = await AutomationService.deleteScheduledCampaign(req.params.id);
      if (!deleted) return res.status(404).json({ error: 'Campaign not found' });
      res.json({ success: true });
    } catch {
      res.status(500).json({ error: 'Failed to delete campaign' });
    }
  }) as RequestHandler,
};
