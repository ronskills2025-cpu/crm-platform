import api from '../../../packages/utils/src/http';

// ── SaaS: Auth API ───────────────────────────────────────────────
export const authApiClient = {
  login: (email: string, password: string) => api.post('/auth/login', { email, password }).then((r) => r.data),
  me: () => api.get('/auth/me').then((r) => r.data),
  changePassword: (currentPassword: string, newPassword: string) =>
    api.patch('/auth/me/password', { currentPassword, newPassword }).then((r) => r.data),
  listUsers: () => api.get('/auth/users').then((r) => r.data),
  inviteUser: (data: Record<string, unknown>) => api.post('/auth/users/invite', data).then((r) => r.data),
};

// ── SaaS: Tenant API ─────────────────────────────────────────────
export const tenantApi = {
  list: (params?: Record<string, string>) => api.get('/tenants', { params }).then((r) => r.data),
  create: (data: Record<string, unknown>) => api.post('/tenants', data).then((r) => r.data),
  getById: (id: string) => api.get(`/tenants/${id}`).then((r) => r.data),
  update: (id: string, data: Record<string, unknown>) => api.patch(`/tenants/${id}`, data).then((r) => r.data),
  delete: (id: string) => api.delete(`/tenants/${id}`).then((r) => r.data),
  getStats: (id: string) => api.get(`/tenants/${id}/stats`).then((r) => r.data),
  listNumbers: (id: string) => api.get(`/tenants/${id}/numbers`).then((r) => r.data),
  addNumber: (id: string, data: Record<string, unknown>) => api.post(`/tenants/${id}/numbers`, data).then((r) => r.data),
  removeNumber: (id: string, numberId: string) => api.delete(`/tenants/${id}/numbers/${numberId}`).then((r) => r.data),
};

// ── SaaS: Billing API ────────────────────────────────────────────
export const billingApi = {
  getPlans: () => api.get('/billing/plans').then((r) => r.data),
  getSubscription: () => api.get('/billing/subscription').then((r) => r.data),
  createCheckout: (plan: string, successUrl: string, cancelUrl: string) =>
    api.post('/billing/checkout', { plan, successUrl, cancelUrl }).then((r) => r.data),
  cancel: () => api.post('/billing/subscription/cancel').then((r) => r.data),
  reactivate: () => api.post('/billing/subscription/reactivate').then((r) => r.data),
};

// ── SaaS: WABA Template API ──────────────────────────────────────
export const templateApi = {
  list: (params?: Record<string, string>) => api.get('/templates', { params }).then((r) => r.data),
  create: (data: Record<string, unknown>) => api.post('/templates', data).then((r) => r.data),
  getById: (id: string) => api.get(`/templates/${id}`).then((r) => r.data),
  update: (id: string, data: Record<string, unknown>) => api.patch(`/templates/${id}`, data).then((r) => r.data),
  delete: (id: string) => api.delete(`/templates/${id}`).then((r) => r.data),
  submitToMeta: (id: string, data: { accessToken: string; wabaId: string }) =>
    api.post(`/templates/${id}/submit`, data).then((r) => r.data),
};

// ── SaaS: Cart Recovery API ──────────────────────────────────────
export const cartApi = {
  listSessions: (params?: Record<string, string>) => api.get('/shopify/sessions', { params }).then((r) => r.data),
  getStats: () => api.get('/shopify/stats').then((r) => r.data),
  markRecovered: (cartToken: string) => api.post(`/shopify/sessions/${cartToken}/recover`).then((r) => r.data),
  listConversions: (params?: Record<string, string>) => api.get('/shopify/conversions', { params }).then((r) => r.data),
  getConversionStats: () => api.get('/shopify/conversions/stats').then((r) => r.data),
};
