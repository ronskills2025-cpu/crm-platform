import { Response } from 'express';
import { ProductService } from './product.service';
import { z } from 'zod';
import type { AuthRequest } from '../../../packages/utils/src/auth.middleware';
import { createLogger } from '../../../packages/utils/src/logger';

const log = createLogger('ctrl:product-dashboard');

const RegisterProductSchema = z.object({
  productType: z.enum(['funnel', 'cart_recovery', 'appointment', 'payment', 'review']),
  name: z.string().min(1),
});

const SetConfigSchema = z.object({
  key: z.string().min(1),
  value: z.unknown(),
});

export class ProductDashboardController {
  // ── Product registry ──────────────────────────────────────────
  static async register(req: AuthRequest, res: Response) {
    try {
      const d = RegisterProductSchema.parse(req.body);
      const product = await ProductService.register(req.tenantId!, d.productType, d.name);
      res.status(201).json({ success: true, product });
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors });
      log.error('register failed', err);
      res.status(500).json({ error: 'Failed to register product' });
    }
  }

  static async listProducts(req: AuthRequest, res: Response) {
    try {
      const products = await ProductService.listForTenant(req.tenantId!);
      res.json({ success: true, products });
    } catch (err) {
      log.error('listProducts failed', err);
      res.status(500).json({ error: 'Failed to list products' });
    }
  }

  static async toggleProduct(req: AuthRequest, res: Response) {
    try {
      const product = await ProductService.toggle(req.params.id);
      if (!product) return res.status(404).json({ error: 'Product not found' });
      res.json({ success: true, product });
    } catch (err) {
      log.error('toggleProduct failed', err);
      res.status(500).json({ error: 'Failed to toggle product' });
    }
  }

  static async deleteProduct(req: AuthRequest, res: Response) {
    try {
      await ProductService.deleteProduct(req.params.id);
      res.json({ success: true });
    } catch (err) {
      log.error('deleteProduct failed', err);
      res.status(500).json({ error: 'Failed to delete product' });
    }
  }

  // ── Config ────────────────────────────────────────────────────
  static async setConfig(req: AuthRequest, res: Response) {
    try {
      const d = SetConfigSchema.parse(req.body);
      await ProductService.setConfig(req.params.id, d.key, d.value);
      res.json({ success: true });
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors });
      log.error('setConfig failed', err);
      res.status(500).json({ error: 'Failed to set config' });
    }
  }

  static async getConfig(req: AuthRequest, res: Response) {
    try {
      const config = await ProductService.getAllConfig(req.params.id);
      res.json({ success: true, config });
    } catch (err) {
      log.error('getConfig failed', err);
      res.status(500).json({ error: 'Failed to get config' });
    }
  }

  // ── Events + Notifications ────────────────────────────────────
  static async listEvents(req: AuthRequest, res: Response) {
    try {
      const events = await ProductService.listEvents(req.tenantId!, {
        productType: req.query.productType as string,
        limit: parseInt(req.query.limit as string) || 50,
      });
      res.json({ success: true, events });
    } catch (err) {
      log.error('listEvents failed', err);
      res.status(500).json({ error: 'Failed to list events' });
    }
  }

  static async listNotifications(req: AuthRequest, res: Response) {
    try {
      const notifications = await ProductService.listNotifications(req.tenantId!, {
        unreadOnly: req.query.unread === 'true',
        limit: parseInt(req.query.limit as string) || 50,
      });
      res.json({ success: true, notifications });
    } catch (err) {
      log.error('listNotifications failed', err);
      res.status(500).json({ error: 'Failed to list notifications' });
    }
  }

  static async markNotificationsRead(req: AuthRequest, res: Response) {
    try {
      const { ids } = z.object({ ids: z.array(z.string().uuid()) }).parse(req.body);
      await ProductService.markNotificationsRead(req.tenantId!, ids);
      res.json({ success: true });
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors });
      log.error('markNotificationsRead failed', err);
      res.status(500).json({ error: 'Failed to mark notifications read' });
    }
  }

  // ── Dashboard stats ───────────────────────────────────────────
  static async getDashboardStats(req: AuthRequest, res: Response) {
    try {
      const stats = await ProductService.getDashboardStats(req.tenantId!);
      res.json({ success: true, stats });
    } catch (err) {
      log.error('getDashboardStats failed', err);
      res.status(500).json({ error: 'Failed to get dashboard stats' });
    }
  }
}
