import api from '../../../packages/utils/src/http';

type R = Record<string, unknown>;

export const growthApi = {
  // Dashboard
  getDashboard: () => api.get('/growth/dashboard').then(r => r.data),

  // Notifications
  listNotifications: (params?: R) => api.get('/growth/notifications', { params }).then(r => r.data),
  markNotificationRead: (id: string) => api.patch(`/growth/notifications/${id}/read`).then(r => r.data),
  markAllNotificationsRead: () => api.patch('/growth/notifications/read-all').then(r => r.data),

  // Lead Capture
  leadCapture: {
    listForms: () => api.get('/growth/lead-capture/forms').then(r => r.data),
    createForm: (data: R) => api.post('/growth/lead-capture/forms', data).then(r => r.data),
    getForm: (id: string) => api.get(`/growth/lead-capture/forms/${id}`).then(r => r.data),
    updateForm: (id: string, data: R) => api.put(`/growth/lead-capture/forms/${id}`, data).then(r => r.data),
    deleteForm: (id: string) => api.delete(`/growth/lead-capture/forms/${id}`).then(r => r.data),
    submit: (data: R) => api.post('/growth/lead-capture/submit', data).then(r => r.data),
    listSubmissions: (params?: R) => api.get('/growth/lead-capture/submissions', { params }).then(r => r.data),
    getStats: () => api.get('/growth/lead-capture/stats').then(r => r.data),
  },

  // Missed Call
  missedCall: {
    listConfigs: () => api.get('/growth/missed-call/configs').then(r => r.data),
    createConfig: (data: R) => api.post('/growth/missed-call/configs', data).then(r => r.data),
    getConfig: (id: string) => api.get(`/growth/missed-call/configs/${id}`).then(r => r.data),
    updateConfig: (id: string, data: R) => api.put(`/growth/missed-call/configs/${id}`, data).then(r => r.data),
    deleteConfig: (id: string) => api.delete(`/growth/missed-call/configs/${id}`).then(r => r.data),
    logCall: (data: R) => api.post('/growth/missed-call/log', data).then(r => r.data),
    listCalls: (params?: R) => api.get('/growth/missed-call/calls', { params }).then(r => r.data),
    getStats: () => api.get('/growth/missed-call/stats').then(r => r.data),
  },

  // Follow-Up
  followup: {
    listSequences: () => api.get('/growth/followup/sequences').then(r => r.data),
    createSequence: (data: R) => api.post('/growth/followup/sequences', data).then(r => r.data),
    getSequence: (id: string) => api.get(`/growth/followup/sequences/${id}`).then(r => r.data),
    updateSequence: (id: string, data: R) => api.put(`/growth/followup/sequences/${id}`, data).then(r => r.data),
    deleteSequence: (id: string) => api.delete(`/growth/followup/sequences/${id}`).then(r => r.data),
    toggleSequence: (id: string) => api.patch(`/growth/followup/sequences/${id}/toggle`).then(r => r.data),
    enroll: (data: R) => api.post('/growth/followup/enroll', data).then(r => r.data),
    listEnrollments: (params?: R) => api.get('/growth/followup/enrollments', { params }).then(r => r.data),
    getStats: () => api.get('/growth/followup/stats').then(r => r.data),
  },

  // Loyalty
  loyalty: {
    listPrograms: () => api.get('/growth/loyalty/programs').then(r => r.data),
    createProgram: (data: R) => api.post('/growth/loyalty/programs', data).then(r => r.data),
    getProgram: (id: string) => api.get(`/growth/loyalty/programs/${id}`).then(r => r.data),
    updateProgram: (id: string, data: R) => api.put(`/growth/loyalty/programs/${id}`, data).then(r => r.data),
    listMembers: (params?: R) => api.get('/growth/loyalty/members', { params }).then(r => r.data),
    addMember: (data: R) => api.post('/growth/loyalty/members', data).then(r => r.data),
    getMember: (id: string) => api.get(`/growth/loyalty/members/${id}`).then(r => r.data),
    getTransactions: (memberId: string) => api.get(`/growth/loyalty/members/${memberId}/transactions`).then(r => r.data),
    addTransaction: (data: R) => api.post('/growth/loyalty/transactions', data).then(r => r.data),
    listRewards: (programId?: string) => api.get('/growth/loyalty/rewards', { params: { program_id: programId } }).then(r => r.data),
    createReward: (data: R) => api.post('/growth/loyalty/rewards', data).then(r => r.data),
    redeemReward: (memberId: string, rewardId: string) => api.post(`/growth/loyalty/members/${memberId}/redeem/${rewardId}`).then(r => r.data),
    getStats: () => api.get('/growth/loyalty/stats').then(r => r.data),
  },

  // Referral
  referral: {
    listPrograms: () => api.get('/growth/referral/programs').then(r => r.data),
    createProgram: (data: R) => api.post('/growth/referral/programs', data).then(r => r.data),
    getProgram: (id: string) => api.get(`/growth/referral/programs/${id}`).then(r => r.data),
    updateProgram: (id: string, data: R) => api.put(`/growth/referral/programs/${id}`, data).then(r => r.data),
    listLinks: (programId?: string) => api.get('/growth/referral/links', { params: { program_id: programId } }).then(r => r.data),
    createLink: (data: R) => api.post('/growth/referral/links', data).then(r => r.data),
    listReferrals: (params?: R) => api.get('/growth/referral/referrals', { params }).then(r => r.data),
    recordReferral: (data: R) => api.post('/growth/referral/referrals', data).then(r => r.data),
    convertReferral: (id: string) => api.patch(`/growth/referral/referrals/${id}/convert`).then(r => r.data),
    getLeaderboard: (programId: string) => api.get(`/growth/referral/leaderboard/${programId}`).then(r => r.data),
    getStats: () => api.get('/growth/referral/stats').then(r => r.data),
  },

  // Review Booster
  reviews: {
    listCampaigns: () => api.get('/growth/reviews/campaigns').then(r => r.data),
    createCampaign: (data: R) => api.post('/growth/reviews/campaigns', data).then(r => r.data),
    getCampaign: (id: string) => api.get(`/growth/reviews/campaigns/${id}`).then(r => r.data),
    updateCampaign: (id: string, data: R) => api.put(`/growth/reviews/campaigns/${id}`, data).then(r => r.data),
    deleteCampaign: (id: string) => api.delete(`/growth/reviews/campaigns/${id}`).then(r => r.data),
    createRequest: (data: R) => api.post('/growth/reviews/requests', data).then(r => r.data),
    listRequests: (campaignId: string, params?: R) => api.get(`/growth/reviews/campaigns/${campaignId}/requests`, { params }).then(r => r.data),
    getStats: () => api.get('/growth/reviews/stats').then(r => r.data),
  },

  // Pipeline
  pipeline: {
    listPipelines: () => api.get('/growth/pipeline/pipelines').then(r => r.data),
    createPipeline: (data: R) => api.post('/growth/pipeline/pipelines', data).then(r => r.data),
    getPipeline: (id: string) => api.get(`/growth/pipeline/pipelines/${id}`).then(r => r.data),
    updatePipeline: (id: string, data: R) => api.put(`/growth/pipeline/pipelines/${id}`, data).then(r => r.data),
    deletePipeline: (id: string) => api.delete(`/growth/pipeline/pipelines/${id}`).then(r => r.data),
    listDeals: (params?: R) => api.get('/growth/pipeline/deals', { params }).then(r => r.data),
    createDeal: (data: R) => api.post('/growth/pipeline/deals', data).then(r => r.data),
    getDeal: (id: string) => api.get(`/growth/pipeline/deals/${id}`).then(r => r.data),
    updateDeal: (id: string, data: R) => api.put(`/growth/pipeline/deals/${id}`, data).then(r => r.data),
    moveDeal: (id: string, data: R) => api.patch(`/growth/pipeline/deals/${id}/move`, data).then(r => r.data),
    deleteDeal: (id: string) => api.delete(`/growth/pipeline/deals/${id}`).then(r => r.data),
    getActivities: (dealId: string) => api.get(`/growth/pipeline/deals/${dealId}/activities`).then(r => r.data),
    logActivity: (data: R) => api.post('/growth/pipeline/activities', data).then(r => r.data),
    getStats: (pipelineId?: string) => api.get('/growth/pipeline/stats', { params: { pipeline_id: pipelineId } }).then(r => r.data),
  },

  // Broadcast
  broadcast: {
    listSegments: (params?: R) => api.get('/growth/broadcast/segments', { params }).then(r => r.data),
    createSegment: (data: R) => api.post('/growth/broadcast/segments', data).then(r => r.data),
    getSegment: (id: string) => api.get(`/growth/broadcast/segments/${id}`).then(r => r.data),
    updateSegment: (id: string, data: R) => api.put(`/growth/broadcast/segments/${id}`, data).then(r => r.data),
    deleteSegment: (id: string) => api.delete(`/growth/broadcast/segments/${id}`).then(r => r.data),
    computeSegment: (id: string) => api.get(`/growth/broadcast/segments/${id}/contacts`).then(r => r.data),
    listCampaigns: (params?: R) => api.get('/growth/broadcast/campaigns', { params }).then(r => r.data),
    createCampaign: (data: R) => api.post('/growth/broadcast/campaigns', data).then(r => r.data),
    getCampaign: (id: string) => api.get(`/growth/broadcast/campaigns/${id}`).then(r => r.data),
    updateCampaign: (id: string, data: R) => api.put(`/growth/broadcast/campaigns/${id}`, data).then(r => r.data),
    deleteCampaign: (id: string) => api.delete(`/growth/broadcast/campaigns/${id}`).then(r => r.data),
    getStats: () => api.get('/growth/broadcast/stats').then(r => r.data),
  },

  // Ads Tracker
  ads: {
    listCampaigns: (params?: R) => api.get('/growth/ads/campaigns', { params }).then(r => r.data),
    createCampaign: (data: R) => api.post('/growth/ads/campaigns', data).then(r => r.data),
    getCampaign: (id: string) => api.get(`/growth/ads/campaigns/${id}`).then(r => r.data),
    updateCampaign: (id: string, data: R) => api.put(`/growth/ads/campaigns/${id}`, data).then(r => r.data),
    deleteCampaign: (id: string) => api.delete(`/growth/ads/campaigns/${id}`).then(r => r.data),
    trackConversion: (data: R) => api.post('/growth/ads/conversions', data).then(r => r.data),
    listConversions: (campaignId: string) => api.get(`/growth/ads/campaigns/${campaignId}/conversions`).then(r => r.data),
    getROI: () => api.get('/growth/ads/roi').then(r => r.data),
    getByPlatform: () => api.get('/growth/ads/platforms').then(r => r.data),
  },

  // Website Builder
  websites: {
    list: () => api.get('/growth/websites').then(r => r.data),
    create: (data: R) => api.post('/growth/websites', data).then(r => r.data),
    getById: (id: string) => api.get(`/growth/websites/${id}`).then(r => r.data),
    update: (id: string, data: R) => api.put(`/growth/websites/${id}`, data).then(r => r.data),
    publish: (id: string) => api.patch(`/growth/websites/${id}/publish`).then(r => r.data),
    unpublish: (id: string) => api.patch(`/growth/websites/${id}/unpublish`).then(r => r.data),
    delete: (id: string) => api.delete(`/growth/websites/${id}`).then(r => r.data),
    getPublic: (slug: string) => api.get(`/growth/websites/public/${slug}`).then(r => r.data),
    submitForm: (slug: string, data: R) => api.post(`/growth/websites/public/${slug}/form`, data).then(r => r.data),
  },
};
