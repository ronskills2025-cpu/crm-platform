import api from '../../../packages/utils/src/http';

export interface AnalyticsFilters {
  from?: string;
  to?: string;
  channel?: string;
  campaign_id?: string;
}

export const analyticsApi = {
  getSummary:    (filters?: AnalyticsFilters) =>
    api.get('/analytics/summary',    { params: filters }).then(r => r.data),
  getLeads:      (filters?: AnalyticsFilters) =>
    api.get('/analytics/leads',      { params: filters }).then(r => r.data),
  getCampaigns:  (filters?: AnalyticsFilters) =>
    api.get('/analytics/campaigns',  { params: filters }).then(r => r.data),
  getChannels:   (filters?: AnalyticsFilters) =>
    api.get('/analytics/channels',   { params: filters }).then(r => r.data),
  getRevenue:    (filters?: AnalyticsFilters) =>
    api.get('/analytics/revenue',    { params: filters }).then(r => r.data),
  getAutomation: (filters?: AnalyticsFilters) =>
    api.get('/analytics/automation', { params: filters }).then(r => r.data),
};
