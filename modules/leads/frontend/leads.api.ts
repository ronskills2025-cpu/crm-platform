import api from '../../../packages/utils/src/http';

// Leads API
export const leadsApi = {
  list: (params?: Record<string, unknown>) => api.get('/leads', { params }).then((r) => r.data),
  create: (data: Record<string, unknown>) => api.post('/leads', data).then((r) => r.data),
  get: (id: string) => api.get(`/leads/${id}`).then((r) => r.data),
  update: (id: string, data: Record<string, unknown>) => api.put(`/leads/${id}`, data).then((r) => r.data),
  tag: (id: string, tags: string[], action: 'add' | 'remove' | 'set' = 'add') =>
    api.patch(`/leads/${id}/tags`, { tags, action }).then((r) => r.data),
  setSegment: (id: string, segment: string) => api.patch(`/leads/${id}/segment`, { segment }).then((r) => r.data),
  setStatus: (id: string, status: string) => api.patch(`/leads/${id}/status`, { status }).then((r) => r.data),
  getStats: () => api.get('/leads/stats').then((r) => r.data),
  getDashboard: () => api.get('/leads/dashboard').then((r) => r.data),
  getAnalytics: () => api.get('/leads/analytics').then((r) => r.data),
  getConversations: (id: string) => api.get(`/leads/${id}/conversations`).then((r) => r.data),
  delete: (id: string) => api.delete(`/leads/${id}`).then((r) => r.data),
};
