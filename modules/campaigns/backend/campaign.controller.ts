import { Request, Response } from 'express';
import { CampaignService } from './campaign.service';
import { CreateCampaignSchema, UpdateCampaignSchema } from './Campaign';
import { z } from 'zod';
import { createLogger } from '../../../packages/utils/src/logger';
import type { AuthRequest } from '../../../packages/utils/src/auth.middleware';

const log = createLogger('ctrl:campaign');

export class CampaignController {
  static async create(req: AuthRequest, res: Response) {
    try {
      const data = CreateCampaignSchema.parse(req.body);
      const campaign = await CampaignService.create({ ...data, tenant_id: req.tenantId });
      res.status(201).json({ success: true, campaign });
    } catch (err) {
      if (err instanceof z.ZodError) { res.status(400).json({ error: 'Validation failed', details: err.errors }); return; }
      log.error('create failed', err);
      res.status(500).json({ error: 'Failed to create campaign' });
    }
  }

  static async getById(req: AuthRequest, res: Response) {
    try {
      const campaign = await CampaignService.getById(req.params.id, req.tenantId);
      if (!campaign) { res.status(404).json({ error: 'Campaign not found' }); return; }
      res.json({ success: true, campaign });
    } catch (err) {
      log.error('getById failed', err);
      res.status(500).json({ error: 'Failed to get campaign' });
    }
  }

  static async list(req: AuthRequest, res: Response) {
    try {
      const { channel, status, search, limit, offset } = req.query;
      const result = await CampaignService.list(
        channel as string | undefined,
        status as string | undefined,
        search as string | undefined,
        parseInt(limit as string) || 50,
        parseInt(offset as string) || 0,
        req.tenantId
      );
      res.json({ success: true, campaigns: result.rows, total: result.total });
    } catch (err) {
      log.error('list failed', err);
      res.status(500).json({ error: 'Failed to list campaigns' });
    }
  }

  static async updateStatus(req: AuthRequest, res: Response) {
    try {
      const { status } = UpdateCampaignSchema.parse(req.body);
      if (!status) { res.status(400).json({ error: 'Status is required' }); return; }
      const campaign = await CampaignService.updateStatus(req.params.id, status);
      res.json({ success: true, campaign });
    } catch (err) {
      if (err instanceof z.ZodError) { res.status(400).json({ error: 'Validation failed', details: err.errors }); return; }
      log.error('updateStatus failed', err);
      res.status(500).json({ error: 'Failed to update campaign' });
    }
  }

  static async pause(req: Request, res: Response) {
    try {
      const campaign = await CampaignService.pause(req.params.id);
      res.json({ success: true, campaign });
    } catch (err) {
      log.error('pause failed', err);
      res.status(500).json({ error: 'Failed to pause campaign' });
    }
  }

  static async resume(req: Request, res: Response) {
    try {
      const campaign = await CampaignService.resume(req.params.id);
      res.json({ success: true, campaign });
    } catch (err) {
      log.error('resume failed', err);
      res.status(500).json({ error: 'Failed to resume campaign' });
    }
  }

  static async getGlobalStats(_req: Request, res: Response) {
    try {
      const stats = await CampaignService.getGlobalStats();
      res.json({ success: true, stats });
    } catch (err) {
      log.error('getGlobalStats failed', err);
      res.status(500).json({ error: 'Failed to get global stats' });
    }
  }

  static async getFailedMessages(req: Request, res: Response) {
    try {
      const { channel, limit } = req.query;
      const messages = await CampaignService.getFailedMessages(
        channel as string | undefined,
        parseInt(limit as string) || 100
      );
      res.json({ success: true, messages });
    } catch (err) {
      log.error('getFailedMessages failed', err);
      res.status(500).json({ error: 'Failed to get failed messages' });
    }
  }
}
