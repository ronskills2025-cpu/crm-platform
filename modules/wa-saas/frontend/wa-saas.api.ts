import api from '../../../packages/utils/src/http';

type R = Record<string, unknown>;
const WA_SAAS_BASE = '/wa-saas';

export const waSaasApi = {
  // Dashboard
  getDashboard: () => api.get(`${WA_SAAS_BASE}/dashboard`).then(r => r.data),

  // Notifications
  listNotifications: (params?: R) => api.get(`${WA_SAAS_BASE}/notifications`, { params }).then(r => r.data),
  markNotificationRead: (id: string) => api.patch(`${WA_SAAS_BASE}/notifications/${id}/read`).then(r => r.data),
  markAllNotificationsRead: () => api.patch(`${WA_SAAS_BASE}/notifications/read-all`).then(r => r.data),

  // Drip Marketing
  drip: {
    listCampaigns: () => api.get('/wa-saas/drip/campaigns').then(r => r.data),
    getCampaign: (id: string) => api.get(`/wa-saas/drip/campaigns/${id}`).then(r => r.data),
    createCampaign: (data: R) => api.post('/wa-saas/drip/campaigns', data).then(r => r.data),
    updateCampaign: (id: string, data: R) => api.put(`/wa-saas/drip/campaigns/${id}`, data).then(r => r.data),
    deleteCampaign: (id: string) => api.delete(`/wa-saas/drip/campaigns/${id}`).then(r => r.data),
    toggleCampaign: (id: string) => api.patch(`/wa-saas/drip/campaigns/${id}/toggle`).then(r => r.data),
    listSteps: (campaignId: string) => api.get(`/wa-saas/drip/campaigns/${campaignId}/steps`).then(r => r.data),
    createStep: (data: R) => api.post('/wa-saas/drip/steps', data).then(r => r.data),
    updateStep: (id: string, data: R) => api.put(`/wa-saas/drip/steps/${id}`, data).then(r => r.data),
    deleteStep: (id: string) => api.delete(`/wa-saas/drip/steps/${id}`).then(r => r.data),
    enroll: (data: R) => api.post('/wa-saas/drip/enroll', data).then(r => r.data),
    listEnrollments: () => api.get('/wa-saas/drip/enrollments').then(r => r.data),
    getStats: () => api.get('/wa-saas/drip/stats').then(r => r.data),
  },

  // AI Auto-Reply Bot
  aiBot: {
    listConfigs: () => api.get('/wa-saas/ai-bot/configs').then(r => r.data),
    getConfig: (id: string) => api.get(`/wa-saas/ai-bot/configs/${id}`).then(r => r.data),
    createConfig: (data: R) => api.post('/wa-saas/ai-bot/configs', data).then(r => r.data),
    updateConfig: (id: string, data: R) => api.put(`/wa-saas/ai-bot/configs/${id}`, data).then(r => r.data),
    deleteConfig: (id: string) => api.delete(`/wa-saas/ai-bot/configs/${id}`).then(r => r.data),
    toggleConfig: (id: string) => api.patch(`/wa-saas/ai-bot/configs/${id}/toggle`).then(r => r.data),
    listFaqs: () => api.get('/wa-saas/ai-bot/faqs').then(r => r.data),
    createFaq: (data: R) => api.post('/wa-saas/ai-bot/faqs', data).then(r => r.data),
    updateFaq: (id: string, data: R) => api.put(`/wa-saas/ai-bot/faqs/${id}`, data).then(r => r.data),
    deleteFaq: (id: string) => api.delete(`/wa-saas/ai-bot/faqs/${id}`).then(r => r.data),
    listConversations: () => api.get('/wa-saas/ai-bot/conversations').then(r => r.data),
    getConversation: (id: string) => api.get(`/wa-saas/ai-bot/conversations/${id}`).then(r => r.data),
    conversationAction: (id: string, data: R) => api.post(`/wa-saas/ai-bot/conversations/${id}/action`, data).then(r => r.data),
    listSuggestions: (convId: string) => api.get(`/wa-saas/ai-bot/conversations/${convId}/suggestions`).then(r => r.data),
    getStats: () => api.get('/wa-saas/ai-bot/stats').then(r => r.data),
  },

  // Order Tracking
  orders: {
    listConfigs: () => api.get('/wa-saas/orders/configs').then(r => r.data),
    createConfig: (data: R) => api.post('/wa-saas/orders/configs', data).then(r => r.data),
    updateConfig: (id: string, data: R) => api.put(`/wa-saas/orders/configs/${id}`, data).then(r => r.data),
    deleteConfig: (id: string) => api.delete(`/wa-saas/orders/configs/${id}`).then(r => r.data),
    list: (params?: R) => api.get('/wa-saas/orders', { params }).then(r => r.data),
    get: (id: string) => api.get(`/wa-saas/orders/${id}`).then(r => r.data),
    create: (data: R) => api.post('/wa-saas/orders', data).then(r => r.data),
    update: (id: string, data: R) => api.put(`/wa-saas/orders/${id}`, data).then(r => r.data),
    addEvent: (data: R) => api.post('/wa-saas/orders/events', data).then(r => r.data),
    listEvents: (orderId: string) => api.get(`/wa-saas/orders/${orderId}/events`).then(r => r.data),
    getStats: () => api.get('/wa-saas/orders/stats/overview').then(r => r.data),
  },

  // Subscription Bot
  subscriptions: {
    listPlans: () => api.get('/wa-saas/subscriptions/plans').then(r => r.data),
    createPlan: (data: R) => api.post('/wa-saas/subscriptions/plans', data).then(r => r.data),
    updatePlan: (id: string, data: R) => api.put(`/wa-saas/subscriptions/plans/${id}`, data).then(r => r.data),
    deletePlan: (id: string) => api.delete(`/wa-saas/subscriptions/plans/${id}`).then(r => r.data),
    list: () => api.get('/wa-saas/subscriptions').then(r => r.data),
    create: (data: R) => api.post('/wa-saas/subscriptions', data).then(r => r.data),
    action: (id: string, data: R) => api.post(`/wa-saas/subscriptions/${id}/action`, data).then(r => r.data),
    recordPayment: (data: R) => api.post('/wa-saas/subscriptions/payments', data).then(r => r.data),
    getStats: () => api.get('/wa-saas/subscriptions/stats').then(r => r.data),
  },

  // Flash Sale
  flashSales: {
    list: () => api.get('/wa-saas/flash-sales').then(r => r.data),
    get: (id: string) => api.get(`/wa-saas/flash-sales/${id}`).then(r => r.data),
    create: (data: R) => api.post('/wa-saas/flash-sales', data).then(r => r.data),
    update: (id: string, data: R) => api.put(`/wa-saas/flash-sales/${id}`, data).then(r => r.data),
    delete: (id: string) => api.delete(`/wa-saas/flash-sales/${id}`).then(r => r.data),
    action: (id: string, data: R) => api.post(`/wa-saas/flash-sales/${id}/action`, data).then(r => r.data),
    listRecipients: (saleId: string) => api.get(`/wa-saas/flash-sales/${saleId}/recipients`).then(r => r.data),
    getStats: () => api.get('/wa-saas/flash-sales/stats/overview').then(r => r.data),
  },

  // Team Inbox
  teamInbox: {
    listAgents: () => api.get('/wa-saas/team-inbox/agents').then(r => r.data),
    createAgent: (data: R) => api.post('/wa-saas/team-inbox/agents', data).then(r => r.data),
    updateAgent: (id: string, data: R) => api.put(`/wa-saas/team-inbox/agents/${id}`, data).then(r => r.data),
    deleteAgent: (id: string) => api.delete(`/wa-saas/team-inbox/agents/${id}`).then(r => r.data),
    setOnline: (id: string, data: R) => api.patch(`/wa-saas/team-inbox/agents/${id}/online`, data).then(r => r.data),
    listConversations: (params?: R) => api.get('/wa-saas/team-inbox/conversations', { params }).then(r => r.data),
    getConversation: (id: string) => api.get(`/wa-saas/team-inbox/conversations/${id}`).then(r => r.data),
    assignConversation: (id: string, data: R) => api.post(`/wa-saas/team-inbox/conversations/${id}/assign`, data).then(r => r.data),
    addTags: (id: string, data: R) => api.post(`/wa-saas/team-inbox/conversations/${id}/tags`, data).then(r => r.data),
    resolveConversation: (id: string) => api.post(`/wa-saas/team-inbox/conversations/${id}/resolve`).then(r => r.data),
    listMessages: (convId: string) => api.get(`/wa-saas/team-inbox/conversations/${convId}/messages`).then(r => r.data),
    sendReply: (data: R) => api.post('/wa-saas/team-inbox/reply', data).then(r => r.data),
    listNotes: (convId: string) => api.get(`/wa-saas/team-inbox/conversations/${convId}/notes`).then(r => r.data),
    addNote: (data: R) => api.post('/wa-saas/team-inbox/notes', data).then(r => r.data),
    getStats: () => api.get('/wa-saas/team-inbox/stats').then(r => r.data),
  },

  // Link Tracking
  links: {
    list: () => api.get('/wa-saas/links').then(r => r.data),
    get: (id: string) => api.get(`/wa-saas/links/${id}`).then(r => r.data),
    create: (data: R) => api.post('/wa-saas/links', data).then(r => r.data),
    update: (id: string, data: R) => api.put(`/wa-saas/links/${id}`, data).then(r => r.data),
    delete: (id: string) => api.delete(`/wa-saas/links/${id}`).then(r => r.data),
    getClicks: (id: string) => api.get(`/wa-saas/links/${id}/clicks`).then(r => r.data),
    recordConversion: (data: R) => api.post('/wa-saas/links/conversions', data).then(r => r.data),
    getStats: () => api.get('/wa-saas/links/stats/overview').then(r => r.data),
  },

  // Re-Engagement
  reengagement: {
    list: () => api.get('/wa-saas/reengagement').then(r => r.data),
    get: (id: string) => api.get(`/wa-saas/reengagement/${id}`).then(r => r.data),
    create: (data: R) => api.post('/wa-saas/reengagement', data).then(r => r.data),
    update: (id: string, data: R) => api.put(`/wa-saas/reengagement/${id}`, data).then(r => r.data),
    delete: (id: string) => api.delete(`/wa-saas/reengagement/${id}`).then(r => r.data),
    action: (id: string, data: R) => api.post(`/wa-saas/reengagement/${id}/action`, data).then(r => r.data),
    listContacts: (campaignId: string) => api.get(`/wa-saas/reengagement/${campaignId}/contacts`).then(r => r.data),
    getStats: () => api.get('/wa-saas/reengagement/stats/overview').then(r => r.data),
  },

  // Broadcast Optimizer
  broadcastOpt: {
    listConfigs: () => api.get('/wa-saas/broadcast-opt/configs').then(r => r.data),
    createConfig: (data: R) => api.post('/wa-saas/broadcast-opt/configs', data).then(r => r.data),
    updateConfig: (id: string, data: R) => api.put(`/wa-saas/broadcast-opt/configs/${id}`, data).then(r => r.data),
    deleteConfig: (id: string) => api.delete(`/wa-saas/broadcast-opt/configs/${id}`).then(r => r.data),
    listBatches: () => api.get('/wa-saas/broadcast-opt/batches').then(r => r.data),
    createBatch: (data: R) => api.post('/wa-saas/broadcast-opt/batches', data).then(r => r.data),
    updateBatch: (id: string, data: R) => api.put(`/wa-saas/broadcast-opt/batches/${id}`, data).then(r => r.data),
    deleteBatch: (id: string) => api.delete(`/wa-saas/broadcast-opt/batches/${id}`).then(r => r.data),
    getStats: () => api.get('/wa-saas/broadcast-opt/stats').then(r => r.data),
  },

  // Business Card Bot
  businessCards: {
    list: () => api.get('/wa-saas/business-cards').then(r => r.data),
    get: (id: string) => api.get(`/wa-saas/business-cards/${id}`).then(r => r.data),
    create: (data: R) => api.post('/wa-saas/business-cards', data).then(r => r.data),
    update: (id: string, data: R) => api.put(`/wa-saas/business-cards/${id}`, data).then(r => r.data),
    delete: (id: string) => api.delete(`/wa-saas/business-cards/${id}`).then(r => r.data),
    toggle: (id: string) => api.patch(`/wa-saas/business-cards/${id}/toggle`).then(r => r.data),
    captureLead: (data: R) => api.post('/wa-saas/business-cards/leads', data).then(r => r.data),
    listLeads: () => api.get('/wa-saas/business-cards/leads/list').then(r => r.data),
    getStats: () => api.get('/wa-saas/business-cards/stats').then(r => r.data),
  },
};

// WhatsApp SaaS and WA SaaS are the same product API surface.
export const whatsappSaasApi = waSaasApi;
