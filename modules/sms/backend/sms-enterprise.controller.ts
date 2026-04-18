import { Response } from 'express';
import type { AuthRequest } from '../../../packages/utils/src/auth.middleware';
import { DLTService } from './sms-dlt.service';
import { SenderIdService } from './sms-sender.service';
import { VirtualNumberService } from './sms-virtual-numbers.service';
import { RegionRoutingService } from './sms-routing.service';
import { SMSAnalyticsService } from './sms-analytics.service';
import { SMSSchedulingService } from './sms-scheduling.service';
import { createLogger } from '../../../packages/utils/src/logger';
import { z } from 'zod';

const log = createLogger('ctrl:sms-enterprise');

// ── Validation Schemas ───────────────────────────────────────────

const DLTEntitySchema = z.object({
  entity_name: z.string().min(1).max(200),
  entity_id: z.string().min(1).max(100),
  telecom_circle: z.string().max(100).optional(),
});

const DLTTemplateSchema = z.object({
  entity_id: z.string().uuid(),
  template_id: z.string().min(1).max(100),
  template_name: z.string().min(1).max(200),
  content_template: z.string().min(1).max(2000),
  variables: z.array(z.string()).default([]),
  message_type: z.enum(['transactional', 'promotional', 'service_implicit', 'service_explicit']).optional(),
});

const SenderIdSchema = z.object({
  sender_id: z.string().min(3).max(11),
  type: z.enum(['alphanumeric', 'numeric', 'shortcode']).optional(),
  region: z.string().max(50).optional(),
  description: z.string().max(200).optional(),
});

const VirtualNumberSchema = z.object({
  phone_number: z.string().min(5).max(20),
  provider: z.string().min(1).max(50),
  region: z.string().max(50).optional(),
  capabilities: z.array(z.string()).optional(),
});

const RegionRouteSchema = z.object({
  region: z.string().min(1).max(50),
  provider_chain: z.array(z.string()).min(1),
  requires_dlt: z.boolean().optional(),
  default_sender_id: z.string().max(11).optional(),
});

const ScheduleJobSchema = z.object({
  campaign_id: z.string().uuid(),
  schedule_type: z.enum(['once', 'recurring']),
  run_at: z.string().optional(),
  cron_expression: z.string().max(100).optional(),
  timezone: z.string().max(50).optional(),
});

// ── Controller ───────────────────────────────────────────────────

export class SMSEnterpriseController {
  // ── DLT Entities ─────────────────────────────────────────────
  static async listDLTEntities(req: AuthRequest, res: Response) {
    try {
      const entities = await DLTService.listEntities(req.tenantId!);
      res.json({ success: true, entities });
    } catch (err) { log.error('listDLTEntities', err); res.status(500).json({ error: 'Failed to list DLT entities' }); }
  }

  static async createDLTEntity(req: AuthRequest, res: Response) {
    try {
      const data = DLTEntitySchema.parse(req.body);
      const entity = await DLTService.createEntity(req.tenantId!, data);
      res.status(201).json({ success: true, entity });
    } catch (err) {
      if (err instanceof z.ZodError) { res.status(400).json({ error: 'Validation failed', details: err.errors }); return; }
      log.error('createDLTEntity', err); res.status(500).json({ error: 'Failed to create DLT entity' });
    }
  }

  static async updateDLTEntity(req: AuthRequest, res: Response) {
    try {
      const entity = await DLTService.updateEntity(req.tenantId!, req.params.id, req.body);
      if (!entity) { res.status(404).json({ error: 'Entity not found' }); return; }
      res.json({ success: true, entity });
    } catch (err) { log.error('updateDLTEntity', err); res.status(500).json({ error: 'Failed to update DLT entity' }); }
  }

  static async deleteDLTEntity(req: AuthRequest, res: Response) {
    try {
      const deleted = await DLTService.deleteEntity(req.tenantId!, req.params.id);
      if (!deleted) { res.status(404).json({ error: 'Entity not found' }); return; }
      res.json({ success: true });
    } catch (err) { log.error('deleteDLTEntity', err); res.status(500).json({ error: 'Failed to delete DLT entity' }); }
  }

  // ── DLT Templates ───────────────────────────────────────────
  static async listDLTTemplates(req: AuthRequest, res: Response) {
    try {
      const entityId = req.query.entity_id as string | undefined;
      const templates = await DLTService.listTemplates(req.tenantId!, entityId);
      res.json({ success: true, templates });
    } catch (err) { log.error('listDLTTemplates', err); res.status(500).json({ error: 'Failed to list DLT templates' }); }
  }

  static async createDLTTemplate(req: AuthRequest, res: Response) {
    try {
      const data = DLTTemplateSchema.parse(req.body);
      const template = await DLTService.createTemplate(req.tenantId!, data);
      res.status(201).json({ success: true, template });
    } catch (err) {
      if (err instanceof z.ZodError) { res.status(400).json({ error: 'Validation failed', details: err.errors }); return; }
      log.error('createDLTTemplate', err); res.status(500).json({ error: 'Failed to create DLT template' });
    }
  }

  static async updateDLTTemplate(req: AuthRequest, res: Response) {
    try {
      const template = await DLTService.updateTemplate(req.tenantId!, req.params.id, req.body);
      if (!template) { res.status(404).json({ error: 'Template not found' }); return; }
      res.json({ success: true, template });
    } catch (err) { log.error('updateDLTTemplate', err); res.status(500).json({ error: 'Failed to update DLT template' }); }
  }

  static async deleteDLTTemplate(req: AuthRequest, res: Response) {
    try {
      const deleted = await DLTService.deleteTemplate(req.tenantId!, req.params.id);
      if (!deleted) { res.status(404).json({ error: 'Template not found' }); return; }
      res.json({ success: true });
    } catch (err) { log.error('deleteDLTTemplate', err); res.status(500).json({ error: 'Failed to delete DLT template' }); }
  }

  static async validateDLTMessage(req: AuthRequest, res: Response) {
    try {
      const { template_id, message } = req.body;
      if (!template_id || !message) { res.status(400).json({ error: 'template_id and message required' }); return; }
      const templates = await DLTService.listTemplates(req.tenantId!);
      const tpl = templates.find((t: Record<string, unknown>) => t.template_id === template_id);
      if (!tpl) { res.status(404).json({ error: 'Template not found' }); return; }
      const valid = DLTService.validateMessage(tpl.content_template, message);
      res.json({ success: true, valid });
    } catch (err) { log.error('validateDLTMessage', err); res.status(500).json({ error: 'Validation check failed' }); }
  }

  // ── Sender IDs ──────────────────────────────────────────────
  static async listSenderIds(req: AuthRequest, res: Response) {
    try {
      const senderIds = await SenderIdService.list(req.tenantId!);
      res.json({ success: true, senderIds });
    } catch (err) { log.error('listSenderIds', err); res.status(500).json({ error: 'Failed to list sender IDs' }); }
  }

  static async createSenderId(req: AuthRequest, res: Response) {
    try {
      const data = SenderIdSchema.parse(req.body);
      const senderId = await SenderIdService.create(req.tenantId!, data);
      res.status(201).json({ success: true, senderId });
    } catch (err) {
      if (err instanceof z.ZodError) { res.status(400).json({ error: 'Validation failed', details: err.errors }); return; }
      log.error('createSenderId', err); res.status(500).json({ error: 'Failed to create sender ID' });
    }
  }

  static async updateSenderId(req: AuthRequest, res: Response) {
    try {
      const senderId = await SenderIdService.update(req.tenantId!, req.params.id, req.body);
      if (!senderId) { res.status(404).json({ error: 'Sender ID not found' }); return; }
      res.json({ success: true, senderId });
    } catch (err) { log.error('updateSenderId', err); res.status(500).json({ error: 'Failed to update sender ID' }); }
  }

  static async deleteSenderId(req: AuthRequest, res: Response) {
    try {
      const deleted = await SenderIdService.delete(req.tenantId!, req.params.id);
      if (!deleted) { res.status(404).json({ error: 'Sender ID not found' }); return; }
      res.json({ success: true });
    } catch (err) { log.error('deleteSenderId', err); res.status(500).json({ error: 'Failed to delete sender ID' }); }
  }

  // ── Virtual Numbers ─────────────────────────────────────────
  static async listVirtualNumbers(req: AuthRequest, res: Response) {
    try {
      const numbers = await VirtualNumberService.list(req.tenantId!);
      res.json({ success: true, numbers });
    } catch (err) { log.error('listVirtualNumbers', err); res.status(500).json({ error: 'Failed to list virtual numbers' }); }
  }

  static async createVirtualNumber(req: AuthRequest, res: Response) {
    try {
      const data = VirtualNumberSchema.parse(req.body);
      const number = await VirtualNumberService.create(req.tenantId!, data);
      res.status(201).json({ success: true, number });
    } catch (err) {
      if (err instanceof z.ZodError) { res.status(400).json({ error: 'Validation failed', details: err.errors }); return; }
      log.error('createVirtualNumber', err); res.status(500).json({ error: 'Failed to create virtual number' });
    }
  }

  static async updateVirtualNumber(req: AuthRequest, res: Response) {
    try {
      const number = await VirtualNumberService.update(req.tenantId!, req.params.id, req.body);
      if (!number) { res.status(404).json({ error: 'Virtual number not found' }); return; }
      res.json({ success: true, number });
    } catch (err) { log.error('updateVirtualNumber', err); res.status(500).json({ error: 'Failed to update virtual number' }); }
  }

  static async deleteVirtualNumber(req: AuthRequest, res: Response) {
    try {
      const deleted = await VirtualNumberService.delete(req.tenantId!, req.params.id);
      if (!deleted) { res.status(404).json({ error: 'Virtual number not found' }); return; }
      res.json({ success: true });
    } catch (err) { log.error('deleteVirtualNumber', err); res.status(500).json({ error: 'Failed to delete virtual number' }); }
  }

  // ── Region Routes ───────────────────────────────────────────
  static async listRegionRoutes(req: AuthRequest, res: Response) {
    try {
      const routes = await RegionRoutingService.listRoutes(req.tenantId!);
      res.json({ success: true, routes });
    } catch (err) { log.error('listRegionRoutes', err); res.status(500).json({ error: 'Failed to list region routes' }); }
  }

  static async upsertRegionRoute(req: AuthRequest, res: Response) {
    try {
      const data = RegionRouteSchema.parse(req.body);
      const route = await RegionRoutingService.upsertRoute(req.tenantId!, data);
      res.json({ success: true, route });
    } catch (err) {
      if (err instanceof z.ZodError) { res.status(400).json({ error: 'Validation failed', details: err.errors }); return; }
      log.error('upsertRegionRoute', err); res.status(500).json({ error: 'Failed to upsert region route' });
    }
  }

  static async deleteRegionRoute(req: AuthRequest, res: Response) {
    try {
      const deleted = await RegionRoutingService.deleteRoute(req.tenantId!, req.params.id);
      if (!deleted) { res.status(404).json({ error: 'Route not found' }); return; }
      res.json({ success: true });
    } catch (err) { log.error('deleteRegionRoute', err); res.status(500).json({ error: 'Failed to delete region route' }); }
  }

  // ── Analytics ───────────────────────────────────────────────
  static async getHourlyAnalytics(req: AuthRequest, res: Response) {
    try {
      const stats = await SMSAnalyticsService.getHourlyStats(req.tenantId!, {
        campaignId: req.query.campaign_id as string,
        provider: req.query.provider as string,
        region: req.query.region as string,
        from: req.query.from as string,
        to: req.query.to as string,
      });
      res.json({ success: true, stats });
    } catch (err) { log.error('getHourlyAnalytics', err); res.status(500).json({ error: 'Failed to get analytics' }); }
  }

  static async getCampaignAnalytics(req: AuthRequest, res: Response) {
    try {
      const stats = await SMSAnalyticsService.getCampaignAnalytics(req.tenantId!, req.params.id);
      res.json({ success: true, stats });
    } catch (err) { log.error('getCampaignAnalytics', err); res.status(500).json({ error: 'Failed to get campaign analytics' }); }
  }

  static async getProviderComparison(req: AuthRequest, res: Response) {
    try {
      const days = parseInt(req.query.days as string) || 7;
      const stats = await SMSAnalyticsService.getProviderComparison(req.tenantId!, days);
      res.json({ success: true, stats });
    } catch (err) { log.error('getProviderComparison', err); res.status(500).json({ error: 'Failed to compare providers' }); }
  }

  static async getRegionalStats(req: AuthRequest, res: Response) {
    try {
      const days = parseInt(req.query.days as string) || 7;
      const stats = await SMSAnalyticsService.getRegionalStats(req.tenantId!, days);
      res.json({ success: true, stats });
    } catch (err) { log.error('getRegionalStats', err); res.status(500).json({ error: 'Failed to get regional stats' }); }
  }

  static async getCostOverview(req: AuthRequest, res: Response) {
    try {
      const days = parseInt(req.query.days as string) || 30;
      const stats = await SMSAnalyticsService.getCostOverview(req.tenantId!, days);
      res.json({ success: true, stats });
    } catch (err) { log.error('getCostOverview', err); res.status(500).json({ error: 'Failed to get cost overview' }); }
  }

  static async materializeAnalytics(req: AuthRequest, res: Response) {
    try {
      await SMSAnalyticsService.materializeHourly(req.tenantId!, req.query.campaign_id as string);
      res.json({ success: true });
    } catch (err) { log.error('materializeAnalytics', err); res.status(500).json({ error: 'Failed to materialize analytics' }); }
  }

  // ── Scheduling ──────────────────────────────────────────────
  static async listScheduledJobs(req: AuthRequest, res: Response) {
    try {
      const jobs = await SMSSchedulingService.listJobs(req.tenantId!);
      res.json({ success: true, jobs });
    } catch (err) { log.error('listScheduledJobs', err); res.status(500).json({ error: 'Failed to list scheduled jobs' }); }
  }

  static async createScheduledJob(req: AuthRequest, res: Response) {
    try {
      const data = ScheduleJobSchema.parse(req.body);
      const job = await SMSSchedulingService.createJob(req.tenantId!, data);
      res.status(201).json({ success: true, job });
    } catch (err) {
      if (err instanceof z.ZodError) { res.status(400).json({ error: 'Validation failed', details: err.errors }); return; }
      log.error('createScheduledJob', err); res.status(500).json({ error: 'Failed to create scheduled job' });
    }
  }

  static async cancelScheduledJob(req: AuthRequest, res: Response) {
    try {
      const job = await SMSSchedulingService.cancelJob(req.tenantId!, req.params.id);
      if (!job) { res.status(404).json({ error: 'Job not found' }); return; }
      res.json({ success: true, job });
    } catch (err) { log.error('cancelScheduledJob', err); res.status(500).json({ error: 'Failed to cancel job' }); }
  }

  static async deleteScheduledJob(req: AuthRequest, res: Response) {
    try {
      const deleted = await SMSSchedulingService.deleteJob(req.tenantId!, req.params.id);
      if (!deleted) { res.status(404).json({ error: 'Job not found' }); return; }
      res.json({ success: true });
    } catch (err) { log.error('deleteScheduledJob', err); res.status(500).json({ error: 'Failed to delete job' }); }
  }
}
