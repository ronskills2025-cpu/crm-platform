import { Response } from 'express';
import { TemplateService } from './template.service';
import { z } from 'zod';
import { createLogger } from '../../../packages/utils/src/logger';
import type { AuthRequest } from '../../../packages/utils/src/auth.middleware';

const log = createLogger('ctrl:template');

const CreateTemplateSchema = z.object({
  name: z.string().min(1).max(255),
  category: z.enum(['MARKETING', 'UTILITY', 'AUTHENTICATION']).default('MARKETING'),
  language: z.string().default('en_US'),
  headerType: z.enum(['TEXT', 'IMAGE', 'VIDEO', 'DOCUMENT', 'NONE']).optional(),
  headerContent: z.string().optional(),
  body: z.string().min(1),
  footer: z.string().optional(),
  buttons: z.array(z.unknown()).default([]),
  variables: z.array(z.string()).optional(),
});

const SubmitToMetaSchema = z.object({
  accessToken: z.string().min(1),
  wabaId: z.string().min(1),
});

export class TemplateController {
  static async create(req: AuthRequest, res: Response) {
    try {
      const data = CreateTemplateSchema.parse(req.body);
      const template = await TemplateService.create(req.tenantId ?? null, data);
      res.status(201).json({ success: true, template });
    } catch (err) {
      if (err instanceof z.ZodError) { res.status(400).json({ error: 'Validation failed', details: err.errors }); return; }
      log.error('create template failed', err);
      res.status(500).json({ error: 'Failed to create template' });
    }
  }

  static async list(req: AuthRequest, res: Response) {
    try {
      const result = await TemplateService.list(req.tenantId ?? null, {
        status: req.query.status as string,
        category: req.query.category as string,
        search: req.query.search as string,
        limit: parseInt(req.query.limit as string) || 50,
        offset: parseInt(req.query.offset as string) || 0,
      });
      res.json({ success: true, ...result });
    } catch (err) {
      log.error('list templates failed', err);
      res.status(500).json({ error: 'Failed to list templates' });
    }
  }

  static async getById(req: AuthRequest, res: Response) {
    try {
      const template = await TemplateService.getById(req.tenantId ?? null, req.params.id);
      if (!template) { res.status(404).json({ error: 'Template not found' }); return; }
      res.json({ success: true, template });
    } catch (err) {
      log.error('getById template failed', err);
      res.status(500).json({ error: 'Failed to get template' });
    }
  }

  static async update(req: AuthRequest, res: Response) {
    try {
      const data = CreateTemplateSchema.partial().parse(req.body);
      const template = await TemplateService.update(req.tenantId ?? null, req.params.id, data);
      if (!template) { res.status(404).json({ error: 'Template not found' }); return; }
      res.json({ success: true, template });
    } catch (err) {
      if (err instanceof z.ZodError) { res.status(400).json({ error: 'Validation failed', details: err.errors }); return; }
      log.error('update template failed', err);
      res.status(500).json({ error: 'Failed to update template' });
    }
  }

  static async delete(req: AuthRequest, res: Response) {
    try {
      const ok = await TemplateService.delete(req.tenantId ?? null, req.params.id);
      if (!ok) { res.status(404).json({ error: 'Template not found' }); return; }
      res.json({ success: true });
    } catch (err) {
      log.error('delete template failed', err);
      res.status(500).json({ error: 'Failed to delete template' });
    }
  }

  static async submitToMeta(req: AuthRequest, res: Response) {
    try {
      const { accessToken, wabaId } = SubmitToMetaSchema.parse(req.body);
      const result = await TemplateService.submitToMeta(accessToken, wabaId, req.params.id, req.tenantId ?? null);
      if (!result.success) { res.status(422).json({ error: result.error }); return; }
      res.json({ success: true, metaTemplateId: result.metaTemplateId });
    } catch (err) {
      if (err instanceof z.ZodError) { res.status(400).json({ error: 'Validation failed', details: err.errors }); return; }
      log.error('submitToMeta failed', err);
      res.status(500).json({ error: 'Failed to submit to Meta' });
    }
  }
}
