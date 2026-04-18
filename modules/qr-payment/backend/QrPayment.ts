import { z } from 'zod';

// ── Payment Config ────────────────────────────────────────────────────────────

export const UpdatePaymentConfigSchema = z.object({
  qr_code_url: z.string().url().optional().nullable(),
  upi_id: z.string().max(100).optional().nullable(),
  bank_details: z.object({
    bank_name: z.string().optional(),
    account_name: z.string().optional(),
    account_number: z.string().optional(),
    ifsc_code: z.string().optional(),
    branch: z.string().optional(),
  }).optional().nullable(),
  whatsapp_number: z.string().max(20).optional().nullable(),
  instructions: z.string().max(2000).optional().nullable(),
  is_enabled: z.boolean().optional(),
});

export type UpdatePaymentConfig = z.infer<typeof UpdatePaymentConfigSchema>;

// ── Payment Submission ────────────────────────────────────────────────────────

export const SubmitPaymentSchema = z.object({
  transaction_id: z.string().min(1).max(100).trim(),
  name: z.string().min(1).max(200).trim(),
  phone: z.string().min(5).max(30).trim(),
  email: z.string().email().max(200).optional().or(z.literal('')),
  amount: z.coerce.number().positive().max(99999999),
});

export type SubmitPayment = z.infer<typeof SubmitPaymentSchema>;

// ── Admin Actions ─────────────────────────────────────────────────────────────

export const ApprovePaymentSchema = z.object({
  notes: z.string().max(500).optional(),
});

export const RejectPaymentSchema = z.object({
  notes: z.string().min(1).max(500),
});

// ── List Filters ──────────────────────────────────────────────────────────────

export const PaymentListQuerySchema = z.object({
  status: z.enum(['pending', 'approved', 'rejected']).optional(),
  phone: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type PaymentListQuery = z.infer<typeof PaymentListQuerySchema>;
