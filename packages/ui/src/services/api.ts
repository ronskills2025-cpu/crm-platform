// ══════════════════════════════════════════════════════════════
// Centralized API re-exports
// Pages import from here for cross-module API access
// ══════════════════════════════════════════════════════════════

// ── Channels ─────────────────────────────────────────────────────
export { whatsappApi, smsApi, emailApi, telegramApi, messengerApi } from '../../../../modules/whatsapp/frontend/channels.api';

// ── Core ──────────────────────────────────────────────────────────
export { campaignApi } from '../../../../modules/campaigns/frontend/campaign.api';
export { analyticsApi } from '../../../../modules/analytics/frontend/analytics.api';
export { leadsApi } from '../../../../modules/leads/frontend/leads.api';
export { automationApi } from '../../../../modules/automation/frontend/automation.api';
export { inboxApi } from '../../../../modules/inbox/frontend/inbox.api';

// ── Social / Instagram ────────────────────────────────────────────
export { instagramApi } from '../../../../modules/instagram/frontend/instagram.api';

// ── Growth ───────────────────────────────────────────────────────
export { growthApi } from '../../../../modules/growth/frontend/growth.api';

// ── WA SaaS ──────────────────────────────────────────────────────
export { waSaasApi } from '../../../../modules/wa-saas/frontend/wa-saas.api';
export { cartApi } from '../../../../modules/wa-saas/frontend/saas.api';

// ── Products suite (9 individual APIs) ───────────────────────────
export {
  funnelApi,
  appointmentApi,
  paymentBotApi,
  reviewApi,
  eventApi,
  catalogApi,
  surveyApi,
  membershipApi,
  productDashboardApi,
} from '../../../../modules/products/frontend/products.api';

// ── Payments & Chat ───────────────────────────────────────────────
export { qrPaymentApi } from '../../../../modules/qr-payment/frontend/qr-payment.api';
export { waChatApi } from '../../../../modules/wa-chat/frontend/wa-chat.api';

// ── Billing, Tenants & Templates ──────────────────────────────────
export { billingApi, tenantApi, templateApi } from './billing-api';

// ── Admin ─────────────────────────────────────────────────────────
export { adminApi } from '../../../../modules/users/frontend/admin.api';

