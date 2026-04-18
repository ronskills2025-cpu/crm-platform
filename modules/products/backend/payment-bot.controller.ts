import { Response } from 'express';
import { PaymentBotService } from './payment-bot.service';
import { z } from 'zod';
import type { AuthRequest } from '../../../packages/utils/src/auth.middleware';
import { createLogger } from '../../../packages/utils/src/logger';

const log = createLogger('ctrl:payment-bot');

const CreateCollectionSchema = z.object({
  productId: z.string().uuid(),
  customerName: z.string().optional(),
  customerPhone: z.string().min(5),
  customerEmail: z.string().email().optional(),
  customerGroup: z.string().optional(),
  amountDue: z.number().positive(),
  currency: z.string().default('USD'),
  dueDate: z.string(),
  paymentLink: z.string().optional(),
  notes: z.string().optional(),
});

const RecordPaymentSchema = z.object({
  amount: z.number().positive(),
  method: z.string().optional(),
  reference: z.string().optional(),
});

export class PaymentBotController {
  static async create(req: AuthRequest, res: Response) {
    try {
      const d = CreateCollectionSchema.parse(req.body);
      const collection = await PaymentBotService.create(req.tenantId!, d.productId, {
        customer_name: d.customerName, customer_phone: d.customerPhone,
        customer_email: d.customerEmail, customer_group: d.customerGroup,
        amount_due: d.amountDue, currency: d.currency,
        due_date: d.dueDate, payment_link: d.paymentLink, notes: d.notes,
      });
      res.status(201).json({ success: true, collection });
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors });
      log.error('create failed', err);
      res.status(500).json({ error: 'Failed to create collection' });
    }
  }

  static async list(req: AuthRequest, res: Response) {
    try {
      const result = await PaymentBotService.list(req.tenantId!, {
        status: req.query.status as string,
        limit: parseInt(req.query.limit as string) || 50,
        offset: parseInt(req.query.offset as string) || 0,
      });
      res.json({ success: true, ...result });
    } catch (err) {
      log.error('list failed', err);
      res.status(500).json({ error: 'Failed to list collections' });
    }
  }

  static async getById(req: AuthRequest, res: Response) {
    try {
      const c = await PaymentBotService.getById(req.params.id);
      if (!c) return res.status(404).json({ error: 'Collection not found' });
      res.json({ success: true, collection: c });
    } catch (err) {
      log.error('getById failed', err);
      res.status(500).json({ error: 'Failed to get collection' });
    }
  }

  static async recordPayment(req: AuthRequest, res: Response) {
    try {
      const d = RecordPaymentSchema.parse(req.body);
      const c = await PaymentBotService.recordPayment(req.params.id, d.amount);
      if (!c) return res.status(404).json({ error: 'Collection not found' });
      res.json({ success: true, collection: c });
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors });
      log.error('recordPayment failed', err);
      res.status(500).json({ error: 'Failed to record payment' });
    }
  }

  static async escalate(req: AuthRequest, res: Response) {
    try {
      const c = await PaymentBotService.escalate(req.params.id);
      if (!c) return res.status(404).json({ error: 'Collection not found' });
      res.json({ success: true, collection: c });
    } catch (err) {
      log.error('escalate failed', err);
      res.status(500).json({ error: 'Failed to escalate' });
    }
  }

  static async getStats(req: AuthRequest, res: Response) {
    try {
      const stats = await PaymentBotService.getStats(req.tenantId!);
      res.json({ success: true, stats });
    } catch (err) {
      log.error('getStats failed', err);
      res.status(500).json({ error: 'Failed to get stats' });
    }
  }
}
