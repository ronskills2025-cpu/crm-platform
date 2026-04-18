import api from '../../../packages/utils/src/http';

// Inbox API
export const inboxApi = {
  getStats: () => api.get('/inbox/stats').then((r) => r.data),
  listThreads: (params: Record<string, unknown>) => api.get('/inbox/threads', { params }).then((r) => r.data),
  getThread: (id: string) => api.get(`/inbox/threads/${id}`).then((r) => r.data),
  markRead: (id: string) => api.post(`/inbox/threads/${id}/read`).then((r) => r.data),
  assignThread: (id: string, assigned_to: string) => api.post(`/inbox/threads/${id}/assign`, { assigned_to }).then((r) => r.data),
  sendReply: (id: string, data: { body: string; subject?: string; provider?: string }) => api.post(`/inbox/threads/${id}/reply`, data).then((r) => r.data),
  retryReply: (messageId: string) => api.post(`/inbox/messages/${messageId}/retry`).then((r) => r.data),
  exportThread: (id: string) => api.get(`/inbox/threads/${id}/export`).then((r) => r.data),
  receiveIncoming: (data: Record<string, unknown>) => api.post('/inbox/incoming', data).then((r) => r.data),
};
