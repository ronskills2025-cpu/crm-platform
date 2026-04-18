import { Response } from 'express';
import { ReviewService } from './review.service';
import { z } from 'zod';
import type { AuthRequest } from '../../../packages/utils/src/auth.middleware';
import { createLogger } from '../../../packages/utils/src/logger';

const log = createLogger('ctrl:review');

const CreateReviewSchema = z.object({
  productId: z.string().uuid(),
  customerName: z.string().optional(),
  customerPhone: z.string().min(5),
  googleReviewUrl: z.string().url().optional(),
  metadata: z.record(z.unknown()).optional(),
});

const SubmitRatingSchema = z.object({
  rating: z.number().int().min(1).max(5),
  feedback: z.string().optional(),
});

export class ReviewController {
  static async create(req: AuthRequest, res: Response) {
    try {
      const d = CreateReviewSchema.parse(req.body);
      const review = await ReviewService.create(req.tenantId!, d.productId, {
        customer_name: d.customerName, customer_phone: d.customerPhone,
        google_review_url: d.googleReviewUrl, metadata: d.metadata,
      });
      res.status(201).json({ success: true, review });
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors });
      log.error('create failed', err);
      res.status(500).json({ error: 'Failed to create review' });
    }
  }

  static async list(req: AuthRequest, res: Response) {
    try {
      const result = await ReviewService.list(req.tenantId!, {
        status: req.query.status as string,
        limit: parseInt(req.query.limit as string) || 50,
        offset: parseInt(req.query.offset as string) || 0,
      });
      res.json({ success: true, ...result });
    } catch (err) {
      log.error('list failed', err);
      res.status(500).json({ error: 'Failed to list reviews' });
    }
  }

  static async getById(req: AuthRequest, res: Response) {
    try {
      const review = await ReviewService.getById(req.params.id);
      if (!review) return res.status(404).json({ error: 'Review not found' });
      res.json({ success: true, review });
    } catch (err) {
      log.error('getById failed', err);
      res.status(500).json({ error: 'Failed to get review' });
    }
  }

  static async submitRating(req: AuthRequest, res: Response) {
    try {
      const d = SubmitRatingSchema.parse(req.body);
      const review = await ReviewService.submitRating(req.params.id, d.rating, d.feedback);
      if (!review) return res.status(404).json({ error: 'Review not found' });
      res.json({ success: true, review });
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors });
      log.error('submitRating failed', err);
      res.status(500).json({ error: 'Failed to submit rating' });
    }
  }

  static async getStats(req: AuthRequest, res: Response) {
    try {
      const stats = await ReviewService.getStats(req.tenantId!);
      res.json({ success: true, stats });
    } catch (err) {
      log.error('getStats failed', err);
      res.status(500).json({ error: 'Failed to get stats' });
    }
  }
}
