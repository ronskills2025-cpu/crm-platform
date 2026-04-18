import api from '../../../packages/utils/src/http';

// ── Instagram Automation API ──────────────────────────────────────
export const instagramApi = {
  // Accounts
  connectAccount: (data: Record<string, unknown>) => api.post('/instagram/accounts', data).then((r) => r.data),
  listAccounts: () => api.get('/instagram/accounts').then((r) => r.data),
  getAccount: (id: string) => api.get(`/instagram/accounts/${id}`).then((r) => r.data),
  updateAccount: (id: string, data: Record<string, unknown>) => api.patch(`/instagram/accounts/${id}`, data).then((r) => r.data),
  deleteAccount: (id: string) => api.delete(`/instagram/accounts/${id}`).then((r) => r.data),

  // DM Inbox
  listConversations: (accountId: string, params?: Record<string, string>) => api.get(`/instagram/accounts/${accountId}/conversations`, { params }).then((r) => r.data),
  getConversation: (accountId: string, senderId: string, params?: Record<string, string>) => api.get(`/instagram/accounts/${accountId}/conversations/${senderId}`, { params }).then((r) => r.data),
  sendDM: (accountId: string, recipientId: string, body: string) => api.post(`/instagram/accounts/${accountId}/dm/${recipientId}`, { body }).then((r) => r.data),
  markConversationRead: (accountId: string, senderId: string) => api.post(`/instagram/accounts/${accountId}/conversations/${senderId}/read`).then((r) => r.data),

  // Comments
  listComments: (params?: Record<string, string>) => api.get('/instagram/comments', { params }).then((r) => r.data),

  // Comment Rules
  createCommentRule: (data: Record<string, unknown>) => api.post('/instagram/comment-rules', data).then((r) => r.data),
  listCommentRules: (params?: Record<string, string>) => api.get('/instagram/comment-rules', { params }).then((r) => r.data),
  getCommentRule: (id: string) => api.get(`/instagram/comment-rules/${id}`).then((r) => r.data),
  updateCommentRule: (id: string, data: Record<string, unknown>) => api.patch(`/instagram/comment-rules/${id}`, data).then((r) => r.data),
  deleteCommentRule: (id: string) => api.delete(`/instagram/comment-rules/${id}`).then((r) => r.data),

  // Story Rules
  createStoryRule: (data: Record<string, unknown>) => api.post('/instagram/story-rules', data).then((r) => r.data),
  listStoryRules: (params?: Record<string, string>) => api.get('/instagram/story-rules', { params }).then((r) => r.data),
  getStoryRule: (id: string) => api.get(`/instagram/story-rules/${id}`).then((r) => r.data),
  updateStoryRule: (id: string, data: Record<string, unknown>) => api.patch(`/instagram/story-rules/${id}`, data).then((r) => r.data),
  deleteStoryRule: (id: string) => api.delete(`/instagram/story-rules/${id}`).then((r) => r.data),

  // Lead Bot
  createLeadBotConfig: (data: Record<string, unknown>) => api.post('/instagram/lead-bot', data).then((r) => r.data),
  listLeadBotConfigs: (params?: Record<string, string>) => api.get('/instagram/lead-bot', { params }).then((r) => r.data),
  getLeadBotConfig: (id: string) => api.get(`/instagram/lead-bot/${id}`).then((r) => r.data),
  updateLeadBotConfig: (id: string, data: Record<string, unknown>) => api.patch(`/instagram/lead-bot/${id}`, data).then((r) => r.data),
  deleteLeadBotConfig: (id: string) => api.delete(`/instagram/lead-bot/${id}`).then((r) => r.data),

  // Leads
  listLeads: (params?: Record<string, string>) => api.get('/instagram/leads', { params }).then((r) => r.data),
  getLead: (id: string) => api.get(`/instagram/leads/${id}`).then((r) => r.data),

  // Content Studio
  createContent: (data: Record<string, unknown>) => api.post('/instagram/content', data).then((r) => r.data),
  listContent: (params?: Record<string, string>) => api.get('/instagram/content', { params }).then((r) => r.data),
  getContent: (id: string) => api.get(`/instagram/content/${id}`).then((r) => r.data),
  updateContent: (id: string, data: Record<string, unknown>) => api.patch(`/instagram/content/${id}`, data).then((r) => r.data),
  deleteContent: (id: string) => api.delete(`/instagram/content/${id}`).then((r) => r.data),
  publishContent: (id: string) => api.post(`/instagram/content/${id}/publish`).then((r) => r.data),

  // Logs
  listLogs: (params?: Record<string, string>) => api.get('/instagram/logs', { params }).then((r) => r.data),

  // Stats
  getStats: () => api.get('/instagram/stats').then((r) => r.data),
};
