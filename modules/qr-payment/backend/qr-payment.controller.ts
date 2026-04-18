import { Response } from 'express';
import { z } from 'zod';
import { createLogger } from '../../../packages/utils/src/logger';
import { QrPaymentConfigService, QrPaymentService, QrPaymentAuditService } from './qr-payment.service';
import {
  UpdatePaymentConfigSchema,
  SubmitPaymentSchema,
  ApprovePaymentSchema,
  RejectPaymentSchema,
  PaymentListQuerySchema,
} from './QrPayment';
import type { AuthRequest } from '../../../packages/utils/src/auth.middleware';
import fs from 'fs';

const log = createLogger('ctrl:qr-payment');

export class QrPaymentController {
  // ── Config ──────────────────────────────────────────────────────────────

  static async getConfig(req: AuthRequest, res: Response) {
    try {
      const cfg = await QrPaymentConfigService.get(req.tenantId!);
      res.json({ success: true, config: cfg });
    } catch (err) {
      log.error('getConfig failed', err);
      res.status(500).json({ error: 'Failed to get payment config' });
    }
  }

  static async updateConfig(req: AuthRequest, res: Response) {
    try {
      const data = UpdatePaymentConfigSchema.parse(req.body);
      const cfg = await QrPaymentConfigService.upsert(req.tenantId!, data);
      res.json({ success: true, config: cfg });
    } catch (err) {
      if (err instanceof z.ZodError) { res.status(400).json({ error: 'Validation failed', details: err.errors }); return; }
      log.error('updateConfig failed', err);
      res.status(500).json({ error: 'Failed to update payment config' });
    }
  }

  // ── Public Config (for checkout page — no auth) ─────────────────────────

  static async getPublicConfig(req: AuthRequest, res: Response) {
    try {
      const tenantId = req.params.tenantId || req.tenantId;
      if (!tenantId) { res.status(400).json({ error: 'Tenant ID required' }); return; }
      const cfg = await QrPaymentConfigService.get(tenantId);
      if (!cfg || !cfg.is_enabled) { res.status(404).json({ error: 'Payment not available' }); return; }
      // Return only public-safe fields
      res.json({
        success: true,
        config: {
          qr_code_url: cfg.qr_code_url,
          upi_id: cfg.upi_id,
          bank_details: cfg.bank_details,
          whatsapp_number: cfg.whatsapp_number,
          instructions: cfg.instructions,
        },
      });
    } catch (err) {
      log.error('getPublicConfig failed', err);
      res.status(500).json({ error: 'Failed to get payment config' });
    }
  }

  // ── Payment Submission ──────────────────────────────────────────────────

  static async submitPayment(req: AuthRequest, res: Response) {
    try {
      const tenantId = req.tenantId!;

      // Validate body fields
      const data = SubmitPaymentSchema.parse(req.body);

      // File is required
      const file = req.file;
      if (!file) {
        res.status(400).json({ error: 'Screenshot is required' });
        return;
      }

      // Duplicate transaction ID check
      const dupTxn = await QrPaymentService.isDuplicateTxnId(tenantId, data.transaction_id);
      if (dupTxn) {
        // Clean up uploaded file
        fs.unlink(file.path, () => {});
        res.status(409).json({ error: 'Transaction ID already submitted' });
        return;
      }

      // Compute screenshot hash for duplicate detection
      const fileBuffer = fs.readFileSync(file.path);
      const hash = QrPaymentService.hashFile(fileBuffer);

      const dupScreenshot = await QrPaymentService.isDuplicateScreenshot(tenantId, hash);
      if (dupScreenshot) {
        fs.unlink(file.path, () => {});
        res.status(409).json({ error: 'This screenshot has already been submitted' });
        return;
      }

      const payment = await QrPaymentService.submit(tenantId, data, file.path, hash);
      res.status(201).json({ success: true, payment });
    } catch (err) {
      // Clean up file on error
      if (req.file) fs.unlink(req.file.path, () => {});
      if (err instanceof z.ZodError) { res.status(400).json({ error: 'Validation failed', details: err.errors }); return; }
      log.error('submitPayment failed', err);
      res.status(500).json({ error: 'Failed to submit payment' });
    }
  }

  // ── Admin: List Payments ────────────────────────────────────────────────

  static async listPayments(req: AuthRequest, res: Response) {
    try {
      const filters = PaymentListQuerySchema.parse(req.query);
      const result = await QrPaymentService.list(req.tenantId!, filters);
      res.json({ success: true, ...result });
    } catch (err) {
      if (err instanceof z.ZodError) { res.status(400).json({ error: 'Validation failed', details: err.errors }); return; }
      log.error('listPayments failed', err);
      res.status(500).json({ error: 'Failed to list payments' });
    }
  }

  // ── Admin: Get Payment Detail ───────────────────────────────────────────

  static async getPayment(req: AuthRequest, res: Response) {
    try {
      const payment = await QrPaymentService.getById(req.tenantId!, req.params.id);
      if (!payment) { res.status(404).json({ error: 'Payment not found' }); return; }
      const auditLogs = await QrPaymentAuditService.listByPayment(req.tenantId!, req.params.id);
      res.json({ success: true, payment, auditLogs });
    } catch (err) {
      log.error('getPayment failed', err);
      res.status(500).json({ error: 'Failed to get payment' });
    }
  }

  // ── Admin: Approve ──────────────────────────────────────────────────────

  static async approvePayment(req: AuthRequest, res: Response) {
    try {
      const { notes } = ApprovePaymentSchema.parse(req.body);
      const payment = await QrPaymentService.approve(req.tenantId!, req.params.id, req.userId!, notes);
      if (!payment) { res.status(404).json({ error: 'Payment not found or already reviewed' }); return; }
      res.json({ success: true, payment });
    } catch (err) {
      if (err instanceof z.ZodError) { res.status(400).json({ error: 'Validation failed', details: err.errors }); return; }
      log.error('approvePayment failed', err);
      res.status(500).json({ error: 'Failed to approve payment' });
    }
  }

  // ── Admin: Reject ───────────────────────────────────────────────────────

  static async rejectPayment(req: AuthRequest, res: Response) {
    try {
      const { notes } = RejectPaymentSchema.parse(req.body);
      const payment = await QrPaymentService.reject(req.tenantId!, req.params.id, req.userId!, notes);
      if (!payment) { res.status(404).json({ error: 'Payment not found or already reviewed' }); return; }
      res.json({ success: true, payment });
    } catch (err) {
      if (err instanceof z.ZodError) { res.status(400).json({ error: 'Validation failed', details: err.errors }); return; }
      log.error('rejectPayment failed', err);
      res.status(500).json({ error: 'Failed to reject payment' });
    }
  }

  // ── Admin: Stats ────────────────────────────────────────────────────────

  static async getStats(req: AuthRequest, res: Response) {
    try {
      const stats = await QrPaymentService.getStats(req.tenantId!);
      res.json({ success: true, stats });
    } catch (err) {
      log.error('getStats failed', err);
      res.status(500).json({ error: 'Failed to get payment stats' });
    }
  }

  // ── Serve Screenshot (admin-only) ───────────────────────────────────────

  static async getScreenshot(req: AuthRequest, res: Response) {
    try {
      const payment = await QrPaymentService.getById(req.tenantId!, req.params.id);
      if (!payment) { res.status(404).json({ error: 'Payment not found' }); return; }

      const filePath = payment.screenshot_path;
      if (!fs.existsSync(filePath)) {
        res.status(404).json({ error: 'Screenshot file not found' });
        return;
      }
      res.sendFile(filePath, { root: '.' });
    } catch (err) {
      log.error('getScreenshot failed', err);
      res.status(500).json({ error: 'Failed to get screenshot' });
    }
  }
}
