import { Response } from 'express';
import { TenantService } from './tenant.service';
import { z } from 'zod';
import { createLogger } from '../../../packages/utils/src/logger';
import type { AuthRequest } from '../../../packages/utils/src/auth.middleware';

const log = createLogger('ctrl:tenant');

const CreateTenantSchema = z.object({
  name: z.string().min(1).max(255),
  slug: z.string().regex(/^[a-z0-9-]+$/).min(2).max(100),
  plan: z.enum(['trial', 'starter', 'pro', 'enterprise']).optional(),
  customDomain: z.string().optional(),
});

const UpdateTenantSchema = z.object({
  name: z.string().min(1).optional(),
  plan: z.enum(['trial', 'starter', 'pro', 'enterprise']).optional(),
  customDomain: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
  setupFeePaid: z.boolean().optional(),
});

const AddNumberSchema = z.object({
  phoneNumberId: z.string().min(1),
  accessToken: z.string().min(1),
  phoneNumber: z.string().optional(),
  displayName: z.string().optional(),
  wabaId: z.string().optional(),
  verifyToken: z.string().optional(),
  webhookUrl: z.string().url().optional(),
});

export class TenantController {
  static async create(req: AuthRequest, res: Response) {
    try {
      const data = CreateTenantSchema.parse(req.body);
      const tenant = await TenantService.create(data);
      res.status(201).json({ success: true, tenant });
    } catch (err) {
      if (err instanceof z.ZodError) { res.status(400).json({ error: 'Validation failed', details: err.errors }); return; }
      if ((err as Error).message?.includes('unique')) { res.status(409).json({ error: 'Slug already exists' }); return; }
      log.error('create tenant failed', err);
      res.status(500).json({ error: 'Failed to create tenant' });
    }
  }

  static async list(req: AuthRequest, res: Response) {
    try {
      const result = await TenantService.list(
        parseInt(req.query.limit as string) || 50,
        parseInt(req.query.offset as string) || 0,
        req.query.search as string | undefined
      );
      res.json({ success: true, ...result });
    } catch (err) {
      log.error('list tenants failed', err);
      res.status(500).json({ error: 'Failed to list tenants' });
    }
  }

  static async getById(req: AuthRequest, res: Response) {
    try {
      const id = req.params.id;
      // Non-superadmin can only view their own tenant
      if (req.userRole !== 'superadmin' && id !== req.tenantId) {
        res.status(403).json({ error: 'Access denied' }); return;
      }
      const tenant = await TenantService.getById(id);
      if (!tenant) { res.status(404).json({ error: 'Tenant not found' }); return; }
      res.json({ success: true, tenant });
    } catch (err) {
      log.error('getById tenant failed', err);
      res.status(500).json({ error: 'Failed to get tenant' });
    }
  }

  static async update(req: AuthRequest, res: Response) {
    try {
      const id = req.params.id;
      if (req.userRole !== 'superadmin' && id !== req.tenantId) {
        res.status(403).json({ error: 'Access denied' }); return;
      }
      const data = UpdateTenantSchema.parse(req.body);
      const tenant = await TenantService.update(id, {
        name: data.name,
        plan: data.plan,
        custom_domain: data.customDomain ?? undefined,
        is_active: data.isActive,
        setup_fee_paid: data.setupFeePaid,
      });
      if (!tenant) { res.status(404).json({ error: 'Tenant not found' }); return; }
      res.json({ success: true, tenant });
    } catch (err) {
      if (err instanceof z.ZodError) { res.status(400).json({ error: 'Validation failed', details: err.errors }); return; }
      log.error('update tenant failed', err);
      res.status(500).json({ error: 'Failed to update tenant' });
    }
  }

  static async delete(req: AuthRequest, res: Response) {
    try {
      const ok = await TenantService.delete(req.params.id);
      if (!ok) { res.status(404).json({ error: 'Tenant not found' }); return; }
      res.json({ success: true });
    } catch (err) {
      log.error('delete tenant failed', err);
      res.status(500).json({ error: 'Failed to delete tenant' });
    }
  }

  static async getStats(req: AuthRequest, res: Response) {
    try {
      const id = req.params.id;
      if (req.userRole !== 'superadmin' && id !== req.tenantId) {
        res.status(403).json({ error: 'Access denied' }); return;
      }
      const stats = await TenantService.getStats(id);
      res.json({ success: true, stats });
    } catch (err) {
      log.error('getStats tenant failed', err);
      res.status(500).json({ error: 'Failed to get stats' });
    }
  }

  // ── Numbers ─────────────────────────────────────────────────────────────────

  static async listNumbers(req: AuthRequest, res: Response) {
    try {
      const tenantId = req.params.tenantId ?? req.tenantId!;
      const numbers = await TenantService.listNumbers(tenantId);
      res.json({ success: true, numbers });
    } catch (err) {
      log.error('listNumbers failed', err);
      res.status(500).json({ error: 'Failed to list numbers' });
    }
  }

  static async addNumber(req: AuthRequest, res: Response) {
    try {
      const tenantId = req.params.tenantId ?? req.tenantId!;
      const data = AddNumberSchema.parse(req.body);
      const number = await TenantService.addNumber({ ...data, tenantId });
      res.status(201).json({ success: true, number });
    } catch (err) {
      if (err instanceof z.ZodError) { res.status(400).json({ error: 'Validation failed', details: err.errors }); return; }
      if ((err as Error).message?.includes('Plan limit')) { res.status(402).json({ error: (err as Error).message }); return; }
      log.error('addNumber failed', err);
      res.status(500).json({ error: 'Failed to add number' });
    }
  }

  static async removeNumber(req: AuthRequest, res: Response) {
    try {
      const { tenantId, numberId } = req.params;
      const effectiveTenantId = tenantId ?? req.tenantId!;
      const ok = await TenantService.removeNumber(effectiveTenantId, numberId);
      if (!ok) { res.status(404).json({ error: 'Number not found' }); return; }
      res.json({ success: true });
    } catch (err) {
      log.error('removeNumber failed', err);
      res.status(500).json({ error: 'Failed to remove number' });
    }
  }
}
