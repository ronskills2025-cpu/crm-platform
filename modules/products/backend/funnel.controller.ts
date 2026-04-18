import { Response } from 'express';
import { FunnelService } from './funnel.service';
import { productQueue } from '../../../packages/utils/src/queues';
import { z } from 'zod';
import type { AuthRequest } from '../../../packages/utils/src/auth.middleware';
import { createLogger } from '../../../packages/utils/src/logger';

const log = createLogger('ctrl:funnel');

const CaptureLeadSchema = z.object({
  productId: z.string().uuid(),
  name: z.string().optional(),
  phone: z.string().min(5),
  source: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

const UpdateLeadSchema = z.object({
  name: z.string().optional(),
  status: z.enum(['new', 'contacted', 'hot', 'converted', 'lost']).optional(),
  payment_amount: z.number().optional(),
});

const UpsertStepSchema = z.object({
  stepNumber: z.number().int().positive(),
  delayHours: z.number().min(0).default(0),
  actionType: z.string().default('whatsapp'),
  messageTemplate: z.string().optional(),
  documentUrl: z.string().optional(),
  config: z.record(z.unknown()).optional(),
});

export class FunnelController {
  static async captureLead(req: AuthRequest, res: Response) {
    try {
      const data = CaptureLeadSchema.parse(req.body);
      const lead = await FunnelService.captureLead(req.tenantId!, data.productId, {
        name: data.name, phone: data.phone, source: data.source,
        metadata: data.metadata,
      });
      // Queue first funnel step
      await productQueue.add('funnel_step', {
        action: 'funnel_step_execute' as const,
        tenantId: req.tenantId!,
        entityId: lead.id,
      }, { delay: 60_000 }); // 1 min delay
      res.status(201).json({ success: true, lead });
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors });
      log.error('captureLead failed', err);
      res.status(500).json({ error: 'Failed to capture lead' });
    }
  }

  static async listLeads(req: AuthRequest, res: Response) {
    try {
      const result = await FunnelService.listLeads(req.tenantId!, {
        status: req.query.status as string,
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
      const lead = await FunnelService.getLead(req.params.id);
      if (!lead) return res.status(404).json({ error: 'Lead not found' });
      res.json({ success: true, lead });
    } catch (err) {
      log.error('getLead failed', err);
      res.status(500).json({ error: 'Failed to get lead' });
    }
  }

  static async updateLead(req: AuthRequest, res: Response) {
    try {
      const data = UpdateLeadSchema.parse(req.body);
      const lead = await FunnelService.updateLead(req.params.id, data);
      if (!lead) return res.status(404).json({ error: 'Lead not found' });
      res.json({ success: true, lead });
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors });
      log.error('updateLead failed', err);
      res.status(500).json({ error: 'Failed to update lead' });
    }
  }

  static async recordClick(req: AuthRequest, res: Response) {
    try {
      await FunnelService.recordClick(req.params.id);
      res.json({ success: true });
    } catch (err) {
      log.error('recordClick failed', err);
      res.status(500).json({ error: 'Failed to record click' });
    }
  }

  static async recordReply(req: AuthRequest, res: Response) {
    try {
      await FunnelService.recordReply(req.params.id);
      res.json({ success: true });
    } catch (err) {
      log.error('recordReply failed', err);
      res.status(500).json({ error: 'Failed to record reply' });
    }
  }

  static async listSteps(req: AuthRequest, res: Response) {
    try {
      const steps = await FunnelService.listSteps(req.params.productId);
      res.json({ success: true, steps });
    } catch (err) {
      log.error('listSteps failed', err);
      res.status(500).json({ error: 'Failed to list steps' });
    }
  }

  static async upsertStep(req: AuthRequest, res: Response) {
    try {
      const data = UpsertStepSchema.parse(req.body);
      const step = await FunnelService.upsertStep(req.params.productId, {
        step_number: data.stepNumber, delay_hours: data.delayHours,
        action_type: data.actionType, message_template: data.messageTemplate,
        document_url: data.documentUrl, config: data.config,
      });
      res.json({ success: true, step });
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors });
      log.error('upsertStep failed', err);
      res.status(500).json({ error: 'Failed to upsert step' });
    }
  }

  static async deleteStep(req: AuthRequest, res: Response) {
    try {
      const stepNum = parseInt(req.params.stepNumber);
      if (isNaN(stepNum)) return res.status(400).json({ error: 'Invalid step number' });
      await FunnelService.deleteStep(req.params.productId, stepNum);
      res.json({ success: true });
    } catch (err) {
      log.error('deleteStep failed', err);
      res.status(500).json({ error: 'Failed to delete step' });
    }
  }

  static async getStats(req: AuthRequest, res: Response) {
    try {
      const stats = await FunnelService.getStats(req.tenantId!);
      res.json({ success: true, stats });
    } catch (err) {
      log.error('getStats failed', err);
      res.status(500).json({ error: 'Failed to get stats' });
    }
  }

  /** POST /api/funnel/webhook/meta — public Meta Ads webhook */
  static async metaWebhook(req: AuthRequest, res: Response) {
    try {
      const tenantId = req.query.tenant_id as string;
      const productId = req.query.product_id as string;
      if (!tenantId || !productId) return res.status(400).json({ error: 'tenant_id and product_id required' });
      const lead = await FunnelService.handleMetaAdsWebhook(tenantId, productId, req.body);
      if (lead) {
        await productQueue.add('funnel_step', {
          action: 'funnel_step_execute' as const,
          tenantId,
          entityId: lead.id,
        }, { delay: 60_000 });
      }
      res.json({ success: true, lead });
    } catch (err) {
      log.error('metaWebhook failed', err);
      res.status(500).json({ error: 'Webhook processing failed' });
    }
  }
}
