import { Response } from 'express';
import { CatalogService } from './catalog.service';
import { z } from 'zod';
import type { AuthRequest } from '../../../packages/utils/src/auth.middleware';
import { createLogger } from '../../../packages/utils/src/logger';

const log = createLogger('ctrl:catalog');

const CreateProductSchema = z.object({
  productId: z.string().uuid(),
  name: z.string().min(1),
  description: z.string().optional(),
  price: z.number().min(0),
  currency: z.string().optional(),
  imageUrl: z.string().url().optional(),
  sku: z.string().optional(),
  stockQuantity: z.number().int().min(0).optional(),
  metadata: z.record(z.unknown()).optional(),
});

const UpdateProductSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  price: z.number().min(0).optional(),
  currency: z.string().optional(),
  imageUrl: z.string().url().optional(),
  sku: z.string().optional(),
  stockQuantity: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
});

const CreateOrderSchema = z.object({
  productId: z.string().uuid(),
  customerName: z.string().optional(),
  customerPhone: z.string().min(5),
  items: z.array(z.object({
    catalogProductId: z.string().uuid(),
    quantity: z.number().int().min(1),
  })).min(1),
  paymentLink: z.string().url().optional(),
  notes: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export class CatalogController {
  // ── Catalog Products ──────────────────────────────────────────────
  static async createProduct(req: AuthRequest, res: Response) {
    try {
      const d = CreateProductSchema.parse(req.body);
      const product = await CatalogService.createProduct(req.tenantId!, d.productId, {
        name: d.name, description: d.description, price: d.price,
        currency: d.currency, image_url: d.imageUrl, sku: d.sku,
        stock_quantity: d.stockQuantity, metadata: d.metadata,
      });
      res.status(201).json({ success: true, product });
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors });
      log.error('createProduct failed', err);
      res.status(500).json({ error: 'Failed to create product' });
    }
  }

  static async listProducts(req: AuthRequest, res: Response) {
    try {
      const result = await CatalogService.listProducts(req.tenantId!, {
        activeOnly: req.query.active === 'true',
        limit: parseInt(req.query.limit as string) || 50,
        offset: parseInt(req.query.offset as string) || 0,
      });
      res.json({ success: true, ...result });
    } catch (err) {
      log.error('listProducts failed', err);
      res.status(500).json({ error: 'Failed to list products' });
    }
  }

  static async getProduct(req: AuthRequest, res: Response) {
    try {
      const product = await CatalogService.getProduct(req.params.id);
      if (!product) return res.status(404).json({ error: 'Product not found' });
      res.json({ success: true, product });
    } catch (err) {
      log.error('getProduct failed', err);
      res.status(500).json({ error: 'Failed to get product' });
    }
  }

  static async updateProduct(req: AuthRequest, res: Response) {
    try {
      const d = UpdateProductSchema.parse(req.body);
      const updates: Record<string, unknown> = {};
      if (d.name !== undefined) updates.name = d.name;
      if (d.description !== undefined) updates.description = d.description;
      if (d.price !== undefined) updates.price = d.price;
      if (d.currency !== undefined) updates.currency = d.currency;
      if (d.imageUrl !== undefined) updates.image_url = d.imageUrl;
      if (d.sku !== undefined) updates.sku = d.sku;
      if (d.stockQuantity !== undefined) updates.stock_quantity = d.stockQuantity;
      if (d.isActive !== undefined) updates.is_active = d.isActive;
      const product = await CatalogService.updateProduct(req.params.id, updates);
      if (!product) return res.status(404).json({ error: 'Product not found' });
      res.json({ success: true, product });
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors });
      log.error('updateProduct failed', err);
      res.status(500).json({ error: 'Failed to update product' });
    }
  }

  static async deleteProduct(req: AuthRequest, res: Response) {
    try {
      const ok = await CatalogService.deleteProduct(req.params.id);
      if (!ok) return res.status(404).json({ error: 'Product not found' });
      res.json({ success: true });
    } catch (err) {
      log.error('deleteProduct failed', err);
      res.status(500).json({ error: 'Failed to delete product' });
    }
  }

  // ── Orders ────────────────────────────────────────────────────────
  static async createOrder(req: AuthRequest, res: Response) {
    try {
      const d = CreateOrderSchema.parse(req.body);
      const order = await CatalogService.createOrder(req.tenantId!, d.productId, {
        customer_name: d.customerName, customer_phone: d.customerPhone,
        items: d.items.map(i => ({ catalog_product_id: i.catalogProductId, quantity: i.quantity })),
        payment_link: d.paymentLink, notes: d.notes, metadata: d.metadata,
      });
      res.status(201).json({ success: true, order });
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors });
      log.error('createOrder failed', err);
      res.status(500).json({ error: 'Failed to create order' });
    }
  }

  static async listOrders(req: AuthRequest, res: Response) {
    try {
      const result = await CatalogService.listOrders(req.tenantId!, {
        status: req.query.status as string,
        limit: parseInt(req.query.limit as string) || 50,
        offset: parseInt(req.query.offset as string) || 0,
      });
      res.json({ success: true, ...result });
    } catch (err) {
      log.error('listOrders failed', err);
      res.status(500).json({ error: 'Failed to list orders' });
    }
  }

  static async getOrder(req: AuthRequest, res: Response) {
    try {
      const order = await CatalogService.getOrder(req.params.id);
      if (!order) return res.status(404).json({ error: 'Order not found' });
      const items = await CatalogService.getOrderItems(order.id);
      res.json({ success: true, order, items });
    } catch (err) {
      log.error('getOrder failed', err);
      res.status(500).json({ error: 'Failed to get order' });
    }
  }

  static async updateOrderStatus(req: AuthRequest, res: Response) {
    try {
      const { status } = z.object({ status: z.enum(['pending', 'confirmed', 'paid', 'shipped', 'delivered', 'cancelled']) }).parse(req.body);
      const order = await CatalogService.updateOrderStatus(req.params.id, status);
      if (!order) return res.status(404).json({ error: 'Order not found' });
      res.json({ success: true, order });
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors });
      log.error('updateOrderStatus failed', err);
      res.status(500).json({ error: 'Failed to update order' });
    }
  }

  static async recordPayment(req: AuthRequest, res: Response) {
    try {
      const { paymentStatus } = z.object({ paymentStatus: z.enum(['none', 'pending', 'paid', 'failed', 'refunded']) }).parse(req.body);
      const order = await CatalogService.recordPayment(req.params.id, paymentStatus);
      if (!order) return res.status(404).json({ error: 'Order not found' });
      res.json({ success: true, order });
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors });
      log.error('recordPayment failed', err);
      res.status(500).json({ error: 'Failed to record payment' });
    }
  }

  static async getStats(req: AuthRequest, res: Response) {
    try {
      const stats = await CatalogService.getStats(req.tenantId!);
      res.json({ success: true, stats });
    } catch (err) {
      log.error('getStats failed', err);
      res.status(500).json({ error: 'Failed to get stats' });
    }
  }
}
