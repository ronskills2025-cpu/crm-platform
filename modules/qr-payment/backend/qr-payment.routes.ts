import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { QrPaymentController } from './qr-payment.controller';
import { authenticate, optionalAuth } from '../../../packages/utils/src/auth.middleware';
import { rateLimiter } from '../../../packages/utils/src/rate-limiter';

const router = Router();

// ── Upload directory ──────────────────────────────────────────────────────────
const UPLOAD_DIR = path.join(process.cwd(), 'uploads', 'qr-payments');
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// ── Multer config ─────────────────────────────────────────────────────────────
const ALLOWED_MIMES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    cb(null, `${uuidv4()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIMES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only JPEG, PNG, WebP and GIF images are allowed'));
    }
  },
});

// ── Public routes ─────────────────────────────────────────────────────────────

// Get public payment config (for checkout page)
router.get('/public-config/:tenantId', QrPaymentController.getPublicConfig as never);

// ── Authenticated routes ──────────────────────────────────────────────────────

// Submit a payment (rate limited: 5 per minute per IP)
router.post(
  '/submit',
  authenticate,
  rateLimiter(5, 60),
  upload.single('screenshot'),
  QrPaymentController.submitPayment as never
);

// Check payment status (user's own payments)
router.get('/my-payments', authenticate, QrPaymentController.listPayments as never);

// ── Admin routes ──────────────────────────────────────────────────────────────

// Config management
router.get('/config', authenticate, QrPaymentController.getConfig as never);
router.put('/config', authenticate, QrPaymentController.updateConfig as never);

// Payment management
router.get('/payments', authenticate, QrPaymentController.listPayments as never);
router.get('/payments/stats', authenticate, QrPaymentController.getStats as never);
router.get('/payments/:id', authenticate, QrPaymentController.getPayment as never);
router.get('/payments/:id/screenshot', authenticate, QrPaymentController.getScreenshot as never);
router.post('/payments/:id/approve', authenticate, QrPaymentController.approvePayment as never);
router.post('/payments/:id/reject', authenticate, QrPaymentController.rejectPayment as never);

export default router;
