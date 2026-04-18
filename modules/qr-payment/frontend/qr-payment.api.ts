import api from '../../../packages/utils/src/http';

type R = Record<string, unknown>;

// ── QR Payment API ────────────────────────────────────────────────────────────
export const qrPaymentApi = {
  // Admin config
  getConfig: () => api.get('/qr-payment/config').then(r => r.data),
  updateConfig: (data: R) => api.put('/qr-payment/config', data).then(r => r.data),

  // Public config (for checkout page)
  getPublicConfig: (tenantId: string) => api.get(`/qr-payment/public-config/${tenantId}`).then(r => r.data),

  // Payment submission (multipart with screenshot)
  submitPayment: (formData: FormData) =>
    api.post('/qr-payment/submit', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then(r => r.data),

  // User's payments
  myPayments: (params?: Record<string, string>) => api.get('/qr-payment/my-payments', { params }).then(r => r.data),

  // Admin: payment management
  listPayments: (params?: Record<string, string>) => api.get('/qr-payment/payments', { params }).then(r => r.data),
  getPayment: (id: string) => api.get(`/qr-payment/payments/${id}`).then(r => r.data),
  getStats: () => api.get('/qr-payment/payments/stats').then(r => r.data),
  getScreenshotUrl: (id: string) => `/api/qr-payment/payments/${id}/screenshot`,
  approvePayment: (id: string, data?: R) => api.post(`/qr-payment/payments/${id}/approve`, data || {}).then(r => r.data),
  rejectPayment: (id: string, data: R) => api.post(`/qr-payment/payments/${id}/reject`, data).then(r => r.data),
};
