import api from '../../../packages/utils/src/http';

// WhatsApp API
export const whatsappApi = {
  sendBatch: (data: Record<string, unknown>) => api.post('/whatsapp/send-batch', data).then((r) => r.data),
  getCampaignStats: (id: string) => api.get(`/whatsapp/campaign/${id}/stats`).then((r) => r.data),
  getDailyStats: (days?: number) => api.get('/whatsapp/stats/daily', { params: { days } }).then((r) => r.data),
  getProviderStats: () => api.get('/whatsapp/stats/providers').then((r) => r.data),
  retryFailed: (id: string) => api.post(`/whatsapp/campaign/${id}/retry`).then((r) => r.data),
};

// SMS API
export const smsApi = {
  sendBatch: (data: Record<string, unknown>) => api.post('/sms/send-batch', data).then((r) => r.data),
  getCampaignStats: (id: string) => api.get(`/sms/campaign/${id}/stats`).then((r) => r.data),
  getDailyStats: (days?: number) => api.get('/sms/stats/daily', { params: { days } }).then((r) => r.data),
  getProviderStats: () => api.get('/sms/stats/providers').then((r) => r.data),
  retryFailed: (id: string) => api.post(`/sms/campaign/${id}/retry`).then((r) => r.data),

  // DLT Entities
  listDLTEntities: () => api.get('/sms/dlt/entities').then((r) => r.data),
  createDLTEntity: (data: Record<string, unknown>) => api.post('/sms/dlt/entities', data).then((r) => r.data),
  updateDLTEntity: (id: string, data: Record<string, unknown>) => api.put(`/sms/dlt/entities/${id}`, data).then((r) => r.data),
  deleteDLTEntity: (id: string) => api.delete(`/sms/dlt/entities/${id}`).then((r) => r.data),

  // DLT Templates
  listDLTTemplates: (entityId?: string) => api.get('/sms/dlt/templates', { params: { entity_id: entityId } }).then((r) => r.data),
  createDLTTemplate: (data: Record<string, unknown>) => api.post('/sms/dlt/templates', data).then((r) => r.data),
  updateDLTTemplate: (id: string, data: Record<string, unknown>) => api.put(`/sms/dlt/templates/${id}`, data).then((r) => r.data),
  deleteDLTTemplate: (id: string) => api.delete(`/sms/dlt/templates/${id}`).then((r) => r.data),
  validateDLTMessage: (templateId: string, message: string) => api.post('/sms/dlt/validate', { template_id: templateId, message }).then((r) => r.data),

  // Sender IDs
  listSenderIds: () => api.get('/sms/sender-ids').then((r) => r.data),
  createSenderId: (data: Record<string, unknown>) => api.post('/sms/sender-ids', data).then((r) => r.data),
  updateSenderId: (id: string, data: Record<string, unknown>) => api.put(`/sms/sender-ids/${id}`, data).then((r) => r.data),
  deleteSenderId: (id: string) => api.delete(`/sms/sender-ids/${id}`).then((r) => r.data),

  // Virtual Numbers
  listVirtualNumbers: () => api.get('/sms/virtual-numbers').then((r) => r.data),
  createVirtualNumber: (data: Record<string, unknown>) => api.post('/sms/virtual-numbers', data).then((r) => r.data),
  updateVirtualNumber: (id: string, data: Record<string, unknown>) => api.put(`/sms/virtual-numbers/${id}`, data).then((r) => r.data),
  deleteVirtualNumber: (id: string) => api.delete(`/sms/virtual-numbers/${id}`).then((r) => r.data),

  // Region Routes
  listRegionRoutes: () => api.get('/sms/region-routes').then((r) => r.data),
  upsertRegionRoute: (data: Record<string, unknown>) => api.post('/sms/region-routes', data).then((r) => r.data),
  deleteRegionRoute: (id: string) => api.delete(`/sms/region-routes/${id}`).then((r) => r.data),

  // Analytics
  getHourlyAnalytics: (params?: Record<string, string>) => api.get('/sms/analytics/hourly', { params }).then((r) => r.data),
  getCampaignAnalytics: (id: string) => api.get(`/sms/analytics/campaign/${id}`).then((r) => r.data),
  getProviderComparison: (days?: number) => api.get('/sms/analytics/providers', { params: { days } }).then((r) => r.data),
  getRegionalStats: (days?: number) => api.get('/sms/analytics/regions', { params: { days } }).then((r) => r.data),
  getCostOverview: (days?: number) => api.get('/sms/analytics/cost', { params: { days } }).then((r) => r.data),

  // Scheduling
  listScheduledJobs: () => api.get('/sms/scheduled-jobs').then((r) => r.data),
  createScheduledJob: (data: Record<string, unknown>) => api.post('/sms/scheduled-jobs', data).then((r) => r.data),
  cancelScheduledJob: (id: string) => api.post(`/sms/scheduled-jobs/${id}/cancel`).then((r) => r.data),
  deleteScheduledJob: (id: string) => api.delete(`/sms/scheduled-jobs/${id}`).then((r) => r.data),
};

// Email API
export const emailApi = {
  sendBatch: (data: Record<string, unknown>) => api.post('/email/send-batch', data).then((r) => r.data),
  getCampaignStats: (id: string) => api.get(`/email/campaign/${id}/stats`).then((r) => r.data),
  getDailyStats: (days?: number) => api.get('/email/stats/daily', { params: { days } }).then((r) => r.data),
  getProviderStats: () => api.get('/email/stats/providers').then((r) => r.data),
  retryFailed: (id: string) => api.post(`/email/campaign/${id}/retry`).then((r) => r.data),
};

// Telegram API
export const telegramApi = {
  sendBatch: (data: Record<string, unknown>) => api.post('/telegram/send-batch', data).then((r) => r.data),
  getCampaignStats: (id: string) => api.get(`/telegram/campaign/${id}/stats`).then((r) => r.data),
  getDailyStats: (days?: number) => api.get('/telegram/stats/daily', { params: { days } }).then((r) => r.data),
  getProviderStats: () => api.get('/telegram/stats/providers').then((r) => r.data),
  retryFailed: (id: string) => api.post(`/telegram/campaign/${id}/retry`).then((r) => r.data),
  validateBot: (bot_token: string) => api.post('/telegram/validate-bot', { bot_token }).then((r) => r.data),
  setupWebhook: (bot_token: string, webhook_url: string) => api.post('/telegram/setup-webhook', { bot_token, webhook_url }).then((r) => r.data),
};

// Messenger (Facebook) API
export const messengerApi = {
  sendBatch: (data: Record<string, unknown>) => api.post('/messenger/send-batch', data).then((r) => r.data),
  getCampaignStats: (id: string) => api.get(`/messenger/campaign/${id}/stats`).then((r) => r.data),
  getDailyStats: (days?: number) => api.get('/messenger/stats/daily', { params: { days } }).then((r) => r.data),
  getProviderStats: () => api.get('/messenger/stats/providers').then((r) => r.data),
  retryFailed: (id: string) => api.post(`/messenger/campaign/${id}/retry`).then((r) => r.data),
  validatePage: (page_access_token: string) => api.post('/messenger/validate-page', { page_access_token }).then((r) => r.data),
  subscribeApp: (page_access_token: string) => api.post('/messenger/subscribe-app', { page_access_token }).then((r) => r.data),
};
