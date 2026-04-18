import api from '../../../packages/utils/src/http';

// Campaign API
export const campaignApi = {
  create: (data: Record<string, unknown>) => api.post('/campaigns', data).then((r) => r.data),
  list: (params?: Record<string, string>) => api.get('/campaigns', { params }).then((r) => r.data),
  getById: (id: string) => api.get(`/campaigns/${id}`).then((r) => r.data),
  updateStatus: (id: string, status: string) => api.patch(`/campaigns/${id}/status`, { status }).then((r) => r.data),
  pause: (id: string) => api.post(`/campaigns/${id}/pause`).then((r) => r.data),
  resume: (id: string) => api.post(`/campaigns/${id}/resume`).then((r) => r.data),
  getGlobalStats: () => api.get('/campaigns/stats').then((r) => r.data),
  getFailedMessages: (params?: Record<string, string>) => api.get('/campaigns/failed', { params }).then((r) => r.data),
};
