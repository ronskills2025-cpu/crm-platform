import type { RequestHandler } from 'express';
import { LeadsService } from './leads.service';
import {
  CreateLeadSchema, UpdateLeadSchema, TagLeadSchema, SetSegmentSchema, ListLeadsQuerySchema,
} from './Lead';
import { z } from 'zod';
import type { AuthRequest } from '../../../packages/utils/src/auth.middleware';

export const LeadsController = {
  list: (async (req: AuthRequest, res) => {
    try {
      const opts = ListLeadsQuerySchema.parse(req.query);
      const { rows: leads, total } = await LeadsService.listLeads({ ...opts, tenant_id: req.tenantId });
      res.json({ leads, count: leads.length, total });
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors });
      res.status(500).json({ error: 'Failed to list leads' });
    }
  }) as RequestHandler,

  create: (async (req: AuthRequest, res) => {
    try {
      const data = CreateLeadSchema.parse(req.body);
      const lead = await LeadsService.upsertFromIncoming(
        data.channel,
        data.contact_value,
        { name: data.name, campaign_id: data.campaign_id, is_vip: data.is_vip, assigned_to: data.assigned_to, tenant_id: req.tenantId }
      );
      res.status(201).json({ lead });
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors });
      res.status(500).json({ error: 'Failed to create lead' });
    }
  }) as RequestHandler,

  get: (async (req: AuthRequest, res) => {
    try {
      const lead = await LeadsService.getLead(req.params.id, req.tenantId);
      if (!lead) return res.status(404).json({ error: 'Lead not found' });
      res.json({ lead });
    } catch {
      res.status(500).json({ error: 'Failed to get lead' });
    }
  }) as RequestHandler,

  update: (async (req: AuthRequest, res) => {
    try {
      const data = UpdateLeadSchema.parse(req.body);
      const lead = await LeadsService.updateLead(req.params.id, data, req.tenantId);
      if (!lead) return res.status(404).json({ error: 'Lead not found' });
      res.json({ lead });
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors });
      res.status(500).json({ error: 'Failed to update lead' });
    }
  }) as RequestHandler,

  tag: (async (req: AuthRequest, res) => {
    try {
      const { tags, action } = TagLeadSchema.parse(req.body);
      const lead = await LeadsService.tagLead(req.params.id, tags, action, req.tenantId);
      if (!lead) return res.status(404).json({ error: 'Lead not found' });
      res.json({ lead });
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors });
      res.status(500).json({ error: 'Failed to tag lead' });
    }
  }) as RequestHandler,

  setSegment: (async (req: AuthRequest, res) => {
    try {
      const { segment } = SetSegmentSchema.parse(req.body);
      const lead = await LeadsService.setSegment(req.params.id, segment, req.tenantId);
      if (!lead) return res.status(404).json({ error: 'Lead not found' });
      res.json({ lead });
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors });
      res.status(500).json({ error: 'Failed to set segment' });
    }
  }) as RequestHandler,

  stats: (async (req: AuthRequest, res) => {
    try {
      const stats = await LeadsService.getStats(req.tenantId);
      res.json({ stats });
    } catch {
      res.status(500).json({ error: 'Failed to get lead stats' });
    }
  }) as RequestHandler,

  remove: (async (req: AuthRequest, res) => {
    try {
      const deleted = await LeadsService.deleteLead(req.params.id, req.tenantId);
      if (!deleted) return res.status(404).json({ error: 'Lead not found' });
      res.json({ success: true });
    } catch {
      res.status(500).json({ error: 'Failed to delete lead' });
    }
  }) as RequestHandler,

  getConversations: (async (req: AuthRequest, res) => {
    try {
      const data = await LeadsService.getConversations(req.params.id, req.tenantId);
      res.json(data);
    } catch {
      res.status(500).json({ error: 'Failed to get conversations' });
    }
  }) as RequestHandler,

  dashboard: (async (req: AuthRequest, res) => {
    try {
      const stats = await LeadsService.getDashboardStats(req.tenantId);
      res.json(stats);
    } catch {
      res.status(500).json({ error: 'Failed to get dashboard stats' });
    }
  }) as RequestHandler,

  analytics: (async (req: AuthRequest, res) => {
    try {
      const data = await LeadsService.getAnalytics(req.tenantId);
      res.json(data);
    } catch {
      res.status(500).json({ error: 'Failed to get analytics' });
    }
  }) as RequestHandler,

  setStatus: (async (req: AuthRequest, res) => {
    try {
      const { status } = z.object({ status: z.enum(['new', 'contacted', 'converted', 'lost']) }).parse(req.body);
      const lead = await LeadsService.setStatus(req.params.id, status, req.tenantId);
      if (!lead) return res.status(404).json({ error: 'Lead not found' });
      res.json({ lead });
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors });
      res.status(500).json({ error: 'Failed to set status' });
    }
  }) as RequestHandler,
};
