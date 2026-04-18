import api from '../../../packages/utils/src/http';

// Automation API
export const automationApi = {
  listRules: (params?: Record<string, unknown>) => api.get('/automation/rules', { params }).then((r) => r.data),
  createRule: (data: Record<string, unknown>) => api.post('/automation/rules', data).then((r) => r.data),
  getRule: (id: string) => api.get(`/automation/rules/${id}`).then((r) => r.data),
  updateRule: (id: string, data: Record<string, unknown>) => api.put(`/automation/rules/${id}`, data).then((r) => r.data),
  deleteRule: (id: string) => api.delete(`/automation/rules/${id}`).then((r) => r.data),
  toggleRule: (id: string) => api.patch(`/automation/rules/${id}/toggle`).then((r) => r.data),
  getLogs: (params?: Record<string, unknown>) => api.get('/automation/rules/logs', { params }).then((r) => r.data),
  listScheduled: (params?: Record<string, unknown>) => api.get('/automation/scheduled', { params }).then((r) => r.data),
  createScheduled: (data: Record<string, unknown>) => api.post('/automation/scheduled', data).then((r) => r.data),
  updateScheduled: (id: string, data: Record<string, unknown>) => api.put(`/automation/scheduled/${id}`, data).then((r) => r.data),
  cancelScheduled: (id: string) => api.patch(`/automation/scheduled/${id}/cancel`).then((r) => r.data),
  deleteScheduled: (id: string) => api.delete(`/automation/scheduled/${id}`).then((r) => r.data),
};
