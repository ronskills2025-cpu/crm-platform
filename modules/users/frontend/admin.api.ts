import api from '../../../packages/utils/src/http';

// Admin / Provider Configuration API
export const adminApi = {
  listProviders: (channel?: string) =>
    api.get('/admin/providers', { params: channel ? { channel } : undefined }).then((r) => r.data),
  getProviderHealth: (channel?: string) =>
    api.get('/admin/providers/health', { params: channel ? { channel } : undefined }).then((r) => r.data),
  getProvider: (id: string) => api.get(`/admin/providers/${id}`).then((r) => r.data),
  createProvider: (data: Record<string, unknown>) => api.post('/admin/providers', data).then((r) => r.data),
  updateProvider: (id: string, data: Record<string, unknown>) => api.patch(`/admin/providers/${id}`, data).then((r) => r.data),
  deleteProvider: (id: string) => api.delete(`/admin/providers/${id}`).then((r) => r.data),
  reorderProviders: (channel: string, order: Array<{ id: string; priority: number }>) =>
    api.post('/admin/providers/reorder', { channel, order }).then((r) => r.data),
  validateProvider: (id: string) => api.post(`/admin/providers/${id}/validate`).then((r) => r.data),
  pauseProvider: (id: string) => api.post(`/admin/providers/${id}/pause`).then((r) => r.data),
  resumeProvider: (id: string) => api.post(`/admin/providers/${id}/resume`).then((r) => r.data),
  testProvider: (id: string, data: Record<string, unknown>) => api.post(`/admin/providers/${id}/test`, data).then((r) => r.data),
  registerWebhook: (id: string, data: { webhookUrl: string; verifyToken: string }) =>
    api.post(`/admin/providers/${id}/webhook/register`, data).then((r) => r.data),
  getCampaignErrors: (params?: Record<string, string>) => api.get('/admin/campaign-errors', { params }).then((r) => r.data),
  retryCampaign: (campaignId: string) => api.post(`/admin/campaigns/${campaignId}/retry`).then((r) => r.data),
  // System overview & user management
  getSystemOverview: () => api.get('/admin/system-overview').then((r) => r.data),
  getUnifiedDashboard: () => api.get('/admin/unified-dashboard').then((r) => r.data),
  listUsers: () => api.get('/admin/users').then((r) => r.data),
  updateUser: (id: string, data: Record<string, unknown>) => api.patch(`/admin/users/${id}`, data).then((r) => r.data),
  deleteUser: (id: string) => api.delete(`/admin/users/${id}`).then((r) => r.data),
  inviteUser: (data: { email: string; fullName?: string; role?: string }) => api.post('/admin/users/invite', data).then((r) => r.data),
};
