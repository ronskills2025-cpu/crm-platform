/**
 * Admin API Service
 * 
 * Centralized API client for admin panel operations.
 * All endpoints require admin/superadmin authentication.
 */

import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

// Attach auth token to all requests
api.interceptors.request.use((config) => {
  const raw = localStorage.getItem('crm-admin-auth');
  if (raw) {
    try {
      const { state } = JSON.parse(raw);
      if (state?.token) config.headers.Authorization = `Bearer ${state.token}`;
    } catch { /* ignore */ }
  }
  return config;
});

// Handle auth errors globally
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('crm-admin-auth');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export const adminApi = {
  // ══════════════════════════════════════════════════════════════
  // Dashboard & System Overview
  // ══════════════════════════════════════════════════════════════
  getStats: () => api.get('/admin/system-overview').then((r) => r.data),
  getUnifiedDashboard: () => api.get('/admin/unified-dashboard').then((r) => r.data),

  // ══════════════════════════════════════════════════════════════
  // User Management
  // ══════════════════════════════════════════════════════════════
  getUsers: (params?: Record<string, string>) => api.get('/admin/users', { params }).then((r) => r.data),
  inviteUser: (data: { email: string; role: string; name?: string }) => 
    api.post('/admin/users/invite', data).then((r) => r.data),
  updateUserRole: (id: string, data: { role: string }) => 
    api.patch(`/admin/users/${id}`, data).then((r) => r.data),
  deleteUser: (id: string) => api.delete(`/admin/users/${id}`).then((r) => r.data),

  // ══════════════════════════════════════════════════════════════
  // Provider Management (WhatsApp, SMS, Email, etc.)
  // ══════════════════════════════════════════════════════════════
  listProviders: () => api.get('/admin/providers').then((r) => r.data),
  getProvider: (id: string) => api.get(`/admin/providers/${id}`).then((r) => r.data),
  createProvider: (data: Record<string, unknown>) => 
    api.post('/admin/providers', data).then((r) => r.data),
  updateProvider: (id: string, data: Record<string, unknown>) => 
    api.patch(`/admin/providers/${id}`, data).then((r) => r.data),
  deleteProvider: (id: string) => api.delete(`/admin/providers/${id}`).then((r) => r.data),
  reorderProviders: (data: { channel: string; providerIds: string[] }) =>
    api.post('/admin/providers/reorder', data).then((r) => r.data),

  // Provider Actions
  validateProvider: (id: string) => api.post(`/admin/providers/${id}/validate`).then((r) => r.data),
  pauseProvider: (id: string) => api.post(`/admin/providers/${id}/pause`).then((r) => r.data),
  resumeProvider: (id: string) => api.post(`/admin/providers/${id}/resume`).then((r) => r.data),
  testProvider: (id: string) => api.post(`/admin/providers/${id}/test`).then((r) => r.data),
  getProviderHealth: () => api.get('/admin/providers/health').then((r) => r.data),

  // WhatsApp Webhook Management
  registerWebhook: (providerId: string, data: { webhookUrl: string; verifyToken: string }) =>
    api.post(`/admin/providers/${providerId}/webhook/register`, data).then((r) => r.data),

  // ══════════════════════════════════════════════════════════════
  // Campaign Management & Error Handling
  // ══════════════════════════════════════════════════════════════
  getCampaigns: (params?: Record<string, string>) => 
    api.get('/campaigns', { params }).then((r) => r.data),
  getCampaignErrors: (params?: { campaignId?: string; resolved?: boolean }) =>
    api.get('/admin/campaign-errors', { params }).then((r) => r.data),
  retryFailedMessages: (campaignId: string) =>
    api.post(`/admin/campaigns/${campaignId}/retry`).then((r) => r.data),

  // ══════════════════════════════════════════════════════════════
  // Channel-Specific APIs (for channel config pages)
  // ══════════════════════════════════════════════════════════════
  // WhatsApp
  getWhatsAppAccounts: () => api.get('/whatsapp/accounts').then((r) => r.data),
  
  // SMS
  getSmsProviders: () => api.get('/sms/providers').then((r) => r.data),
  getSmsStats: () => api.get('/sms/stats').then((r) => r.data),
  
  // Email
  getEmailProviders: () => api.get('/email/providers').then((r) => r.data),
  
  // Telegram
  getTelegramBots: () => api.get('/telegram/bots').then((r) => r.data),
  
  // Messenger
  getMessengerPages: () => api.get('/messenger/pages').then((r) => r.data),
  
  // Instagram
  getInstagramAccounts: () => api.get('/instagram/accounts').then((r) => r.data),
};
