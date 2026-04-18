import { query } from '../../../packages/db/src/connection';
import { publishEvent } from '../../../packages/db/src/redis';
import { createLogger } from '../../../packages/utils/src/logger';
import crypto from 'crypto';
import type { PaymentListQuery, SubmitPayment, UpdatePaymentConfig } from './QrPayment';

const log = createLogger('service:qr-payment');

// ── Config Service ────────────────────────────────────────────────────────────

export class QrPaymentConfigService {
  static async get(tenantId: string) {
    const res = await query(
      `SELECT * FROM qr_payment_config WHERE tenant_id = $1`,
      [tenantId]
    );
    return res.rows[0] || null;
  }

  static async upsert(tenantId: string, data: UpdatePaymentConfig) {
    const existing = await this.get(tenantId);
    if (existing) {
      const sets: string[] = [];
      const vals: unknown[] = [];
      let idx = 1;
      for (const [key, val] of Object.entries(data)) {
        if (val !== undefined) {
          sets.push(`${key} = $${idx}`);
          vals.push(key === 'bank_details' ? JSON.stringify(val) : val);
          idx++;
        }
      }
      if (sets.length === 0) return existing;
      sets.push(`updated_at = NOW()`);
      vals.push(tenantId);
      const result = await query(
        `UPDATE qr_payment_config SET ${sets.join(', ')} WHERE tenant_id = $${idx} RETURNING *`,
        vals
      );
      return result.rows[0];
    }
    const result = await query(
      `INSERT INTO qr_payment_config (tenant_id, qr_code_url, upi_id, bank_details, whatsapp_number, instructions, is_enabled)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [
        tenantId,
        data.qr_code_url || null,
        data.upi_id || null,
        JSON.stringify(data.bank_details || {}),
        data.whatsapp_number || null,
        data.instructions || null,
        data.is_enabled ?? false,
      ]
    );
    return result.rows[0];
  }
}

// ── Payment Service ───────────────────────────────────────────────────────────

export class QrPaymentService {
  /** Compute SHA-256 hash of a file buffer for duplicate detection */
  static hashFile(buffer: Buffer): string {
    return crypto.createHash('sha256').update(buffer).digest('hex');
  }

  /** Check if a transaction ID already exists for this tenant */
  static async isDuplicateTxnId(tenantId: string, transactionId: string): Promise<boolean> {
    const res = await query(
      `SELECT 1 FROM qr_payments WHERE tenant_id = $1 AND transaction_id = $2 LIMIT 1`,
      [tenantId, transactionId]
    );
    return res.rows.length > 0;
  }

  /** Check if a screenshot hash already exists for this tenant */
  static async isDuplicateScreenshot(tenantId: string, hash: string): Promise<boolean> {
    const res = await query(
      `SELECT 1 FROM qr_payments WHERE tenant_id = $1 AND screenshot_hash = $2 LIMIT 1`,
      [tenantId, hash]
    );
    return res.rows.length > 0;
  }

  static async submit(
    tenantId: string,
    data: SubmitPayment,
    screenshotPath: string,
    screenshotHash: string | null
  ) {
    const result = await query(
      `INSERT INTO qr_payments (tenant_id, transaction_id, name, phone, email, amount, screenshot_path, screenshot_hash)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        tenantId,
        data.transaction_id,
        data.name,
        data.phone,
        data.email || null,
        data.amount,
        screenshotPath,
        screenshotHash,
      ]
    );
    const payment = result.rows[0];
    publishEvent('qr_payment:submitted', { tenantId, id: payment.id, name: data.name, amount: data.amount });
    log.info(`Payment submitted: ${payment.id} by ${data.name}`);
    return payment;
  }

  static async list(tenantId: string, filters: PaymentListQuery) {
    const conditions = ['p.tenant_id = $1'];
    const vals: unknown[] = [tenantId];
    let idx = 2;

    if (filters.status) {
      conditions.push(`p.status = $${idx}`);
      vals.push(filters.status);
      idx++;
    }
    if (filters.phone) {
      conditions.push(`p.phone ILIKE $${idx}`);
      vals.push(`%${filters.phone}%`);
      idx++;
    }
    if (filters.from) {
      conditions.push(`p.created_at >= $${idx}`);
      vals.push(filters.from);
      idx++;
    }
    if (filters.to) {
      conditions.push(`p.created_at <= $${idx}`);
      vals.push(filters.to);
      idx++;
    }

    const where = conditions.join(' AND ');
    const offset = (filters.page - 1) * filters.limit;

    const [dataRes, countRes] = await Promise.all([
      query(
        `SELECT p.* FROM qr_payments p WHERE ${where} ORDER BY p.created_at DESC LIMIT $${idx} OFFSET $${idx + 1}`,
        [...vals, filters.limit, offset]
      ),
      query(
        `SELECT COUNT(*) as total FROM qr_payments p WHERE ${where}`,
        vals
      ),
    ]);

    return {
      payments: dataRes.rows,
      total: parseInt(countRes.rows[0].total, 10),
      page: filters.page,
      limit: filters.limit,
    };
  }

  static async getById(tenantId: string, id: string) {
    const res = await query(
      `SELECT * FROM qr_payments WHERE id = $1 AND tenant_id = $2`,
      [id, tenantId]
    );
    return res.rows[0] || null;
  }

  static async approve(tenantId: string, paymentId: string, reviewedBy: string, notes?: string) {
    const result = await query(
      `UPDATE qr_payments
       SET status = 'approved', reviewed_by = $1, reviewed_at = NOW(), admin_notes = $2, updated_at = NOW()
       WHERE id = $3 AND tenant_id = $4 AND status = 'pending'
       RETURNING *`,
      [reviewedBy, notes || null, paymentId, tenantId]
    );
    if (result.rows.length === 0) return null;

    const payment = result.rows[0];
    await QrPaymentAuditService.log(tenantId, paymentId, 'approved', reviewedBy, 'pending', 'approved', notes);
    publishEvent('qr_payment:approved', { tenantId, id: paymentId, name: payment.name, amount: payment.amount });
    log.info(`Payment approved: ${paymentId} by admin ${reviewedBy}`);
    return payment;
  }

  static async reject(tenantId: string, paymentId: string, reviewedBy: string, notes: string) {
    const result = await query(
      `UPDATE qr_payments
       SET status = 'rejected', reviewed_by = $1, reviewed_at = NOW(), admin_notes = $2, updated_at = NOW()
       WHERE id = $3 AND tenant_id = $4 AND status = 'pending'
       RETURNING *`,
      [reviewedBy, notes, paymentId, tenantId]
    );
    if (result.rows.length === 0) return null;

    const payment = result.rows[0];
    await QrPaymentAuditService.log(tenantId, paymentId, 'rejected', reviewedBy, 'pending', 'rejected', notes);
    publishEvent('qr_payment:rejected', { tenantId, id: paymentId, name: payment.name });
    log.info(`Payment rejected: ${paymentId} by admin ${reviewedBy}`);
    return payment;
  }

  static async getStats(tenantId: string) {
    const res = await query(
      `SELECT
         COUNT(*) FILTER (WHERE status = 'pending')  AS pending_count,
         COUNT(*) FILTER (WHERE status = 'approved')  AS approved_count,
         COUNT(*) FILTER (WHERE status = 'rejected')  AS rejected_count,
         COUNT(*) AS total_count,
         COALESCE(SUM(amount) FILTER (WHERE status = 'approved'), 0) AS approved_amount,
         COALESCE(SUM(amount) FILTER (WHERE status = 'pending'), 0) AS pending_amount
       FROM qr_payments WHERE tenant_id = $1`,
      [tenantId]
    );
    return res.rows[0];
  }
}

// ── Audit Service ─────────────────────────────────────────────────────────────

export class QrPaymentAuditService {
  static async log(
    tenantId: string,
    paymentId: string,
    action: string,
    performedBy: string,
    oldStatus?: string,
    newStatus?: string,
    notes?: string
  ) {
    await query(
      `INSERT INTO qr_payment_audit_logs (tenant_id, payment_id, action, performed_by, old_status, new_status, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [tenantId, paymentId, action, performedBy, oldStatus || null, newStatus || null, notes || null]
    );
  }

  static async listByPayment(tenantId: string, paymentId: string) {
    const res = await query(
      `SELECT * FROM qr_payment_audit_logs WHERE tenant_id = $1 AND payment_id = $2 ORDER BY created_at DESC`,
      [tenantId, paymentId]
    );
    return res.rows;
  }
}
