import { Response } from 'express';
import { MembershipService } from './membership.service';
import { z } from 'zod';
import type { AuthRequest } from '../../../packages/utils/src/auth.middleware';
import { createLogger } from '../../../packages/utils/src/logger';

const log = createLogger('ctrl:membership');

const CreateMembershipSchema = z.object({
  productId: z.string().uuid(),
  customerName: z.string().optional(),
  customerPhone: z.string().min(5),
  customerEmail: z.string().email().optional(),
  tier: z.string().optional(),
  startDate: z.string(),
  expiryDate: z.string(),
  autoRenew: z.boolean().optional(),
  paymentLink: z.string().url().optional(),
  amount: z.number().min(0),
  currency: z.string().optional(),
  notes: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

const UpdateMembershipSchema = z.object({
  customerName: z.string().optional(),
  customerPhone: z.string().min(5).optional(),
  customerEmail: z.string().email().optional(),
  tier: z.string().optional(),
  startDate: z.string().optional(),
  expiryDate: z.string().optional(),
  status: z.enum(['active', 'expiring', 'expired', 'renewed', 'cancelled']).optional(),
  autoRenew: z.boolean().optional(),
  paymentLink: z.string().url().optional(),
  amount: z.number().min(0).optional(),
  currency: z.string().optional(),
  notes: z.string().optional(),
  lateFee: z.number().min(0).optional(),
});

const RenewSchema = z.object({
  newExpiryDate: z.string(),
  paymentLink: z.string().url().optional(),
});

export class MembershipController {
  static async create(req: AuthRequest, res: Response) {
    try {
      const d = CreateMembershipSchema.parse(req.body);
      const membership = await MembershipService.create(req.tenantId!, d.productId, {
        customer_name: d.customerName, customer_phone: d.customerPhone,
        customer_email: d.customerEmail, tier: d.tier,
        start_date: d.startDate, expiry_date: d.expiryDate,
        auto_renew: d.autoRenew, payment_link: d.paymentLink,
        amount: d.amount, currency: d.currency, notes: d.notes,
        metadata: d.metadata,
      });
      res.status(201).json({ success: true, membership });
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors });
      log.error('create failed', err);
      res.status(500).json({ error: 'Failed to create membership' });
    }
  }

  static async list(req: AuthRequest, res: Response) {
    try {
      const result = await MembershipService.list(req.tenantId!, {
        status: req.query.status as string,
        tier: req.query.tier as string,
        limit: parseInt(req.query.limit as string) || 50,
        offset: parseInt(req.query.offset as string) || 0,
      });
      res.json({ success: true, ...result });
    } catch (err) {
      log.error('list failed', err);
      res.status(500).json({ error: 'Failed to list memberships' });
    }
  }

  static async getById(req: AuthRequest, res: Response) {
    try {
      const membership = await MembershipService.getById(req.params.id);
      if (!membership) return res.status(404).json({ error: 'Membership not found' });
      res.json({ success: true, membership });
    } catch (err) {
      log.error('getById failed', err);
      res.status(500).json({ error: 'Failed to get membership' });
    }
  }

  static async update(req: AuthRequest, res: Response) {
    try {
      const d = UpdateMembershipSchema.parse(req.body);
      const updates: Record<string, unknown> = {};
      if (d.customerName !== undefined) updates.customer_name = d.customerName;
      if (d.customerPhone !== undefined) updates.customer_phone = d.customerPhone;
      if (d.customerEmail !== undefined) updates.customer_email = d.customerEmail;
      if (d.tier !== undefined) updates.tier = d.tier;
      if (d.startDate !== undefined) updates.start_date = d.startDate;
      if (d.expiryDate !== undefined) updates.expiry_date = d.expiryDate;
      if (d.status !== undefined) updates.status = d.status;
      if (d.autoRenew !== undefined) updates.auto_renew = d.autoRenew;
      if (d.paymentLink !== undefined) updates.payment_link = d.paymentLink;
      if (d.amount !== undefined) updates.amount = d.amount;
      if (d.currency !== undefined) updates.currency = d.currency;
      if (d.notes !== undefined) updates.notes = d.notes;
      if (d.lateFee !== undefined) updates.late_fee = d.lateFee;
      const membership = await MembershipService.update(req.params.id, updates);
      if (!membership) return res.status(404).json({ error: 'Membership not found' });
      res.json({ success: true, membership });
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors });
      log.error('update failed', err);
      res.status(500).json({ error: 'Failed to update membership' });
    }
  }

  static async deleteMembership(req: AuthRequest, res: Response) {
    try {
      const ok = await MembershipService.deleteMembership(req.params.id);
      if (!ok) return res.status(404).json({ error: 'Membership not found' });
      res.json({ success: true });
    } catch (err) {
      log.error('delete failed', err);
      res.status(500).json({ error: 'Failed to delete membership' });
    }
  }

  static async renew(req: AuthRequest, res: Response) {
    try {
      const d = RenewSchema.parse(req.body);
      const membership = await MembershipService.renew(req.params.id, d.newExpiryDate, d.paymentLink);
      if (!membership) return res.status(404).json({ error: 'Membership not found' });
      res.json({ success: true, membership });
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors });
      log.error('renew failed', err);
      res.status(500).json({ error: 'Failed to renew membership' });
    }
  }

  static async recordPayment(req: AuthRequest, res: Response) {
    try {
      const { paymentStatus } = z.object({ paymentStatus: z.enum(['none', 'pending', 'paid', 'failed']) }).parse(req.body);
      const membership = await MembershipService.recordPayment(req.params.id, paymentStatus);
      if (!membership) return res.status(404).json({ error: 'Membership not found' });
      res.json({ success: true, membership });
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors });
      log.error('recordPayment failed', err);
      res.status(500).json({ error: 'Failed to record payment' });
    }
  }

  static async getStats(req: AuthRequest, res: Response) {
    try {
      const stats = await MembershipService.getStats(req.tenantId!);
      res.json({ success: true, stats });
    } catch (err) {
      log.error('getStats failed', err);
      res.status(500).json({ error: 'Failed to get stats' });
    }
  }
}
