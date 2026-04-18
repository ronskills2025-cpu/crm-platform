import api from './http';

export const billingApi = {
  getPlans: () => api.get('/billing/plans').then((r) => r.data),
  getCurrentPlan: () => api.get('/billing/subscription').then((r) => r.data),
  createSubscription: (planId: string) => api.post('/billing/checkout', { plan_id: planId }).then((r) => r.data),
  cancelSubscription: () => api.post('/billing/subscription/cancel').then((r) => r.data),
  getInvoices: () => api.get('/billing/plans').then((r) => r.data),
};

export const tenantApi = {
  list: (params?: Record<string, string>) => api.get('/tenants', { params }).then((r) => r.data),
  getById: (id: string) => api.get(`/tenants/${id}`).then((r) => r.data),
  create: (data: Record<string, unknown>) => api.post('/tenants', data).then((r) => r.data),
  update: (id: string, data: Record<string, unknown>) => api.put(`/tenants/${id}`, data).then((r) => r.data),
  delete: (id: string) => api.delete(`/tenants/${id}`).then((r) => r.data),
  getStats: (id: string) => api.get(`/tenants/${id}/stats`).then((r) => r.data),
};

export const templateApi = {
  list: (params?: Record<string, string>) => api.get('/templates', { params }).then((r) => r.data),
  getById: (id: string) => api.get(`/templates/${id}`).then((r) => r.data),
  create: (data: Record<string, unknown>) => api.post('/templates', data).then((r) => r.data),
  update: (id: string, data: Record<string, unknown>) => api.put(`/templates/${id}`, data).then((r) => r.data),
  delete: (id: string) => api.delete(`/templates/${id}`).then((r) => r.data),
};
