/**
 * apps/web/src/App.tsx — Modular Frontend Entry Point
 *
 * Lazy-loads pages from isolated @modules/* directories.
 * All routes are preserved for backward compatibility.
 */

import { lazy, Suspense, useCallback, useEffect, Component, ReactNode } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useRealtimeEvents } from '../../../packages/ui/src/hooks/useRealtimeEvents';
import { useAppStore } from '../../../packages/ui/src/stores/appStore';
import { useAuthStore } from '../../../modules/users/frontend/stores/authStore';
import { Sidebar } from '../../../packages/ui/src/components/layout/Sidebar';
import { Topbar } from '../../../packages/ui/src/components/layout/Topbar';

// ── Error Boundary — catches individual page crashes ──────────────
class PageErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  componentDidCatch(error: Error) { console.error('[PageError]', error); }
  render() {
    if (this.state.error) {
      return (
        <div className="flex flex-col items-center justify-center h-64 gap-4 text-center">
          <div className="text-4xl">⚠️</div>
          <h2 className="text-lg font-semibold text-red-400">Page Error</h2>
          <p className="text-sm text-gray-400 max-w-md">{(this.state.error as Error).message}</p>
          <button onClick={() => this.setState({ error: null })} className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-medium">
            Try Again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// ══════════════════════════════════════════════════════════════════
// MODULE PAGE IMPORTS — each page lives inside its module
// ══════════════════════════════════════════════════════════════════

// ── Dashboard & Shared Components ─────────────────────────────────
const GlobalDashboard    = lazy(() => import('../../../packages/ui/src/components/shared/GlobalDashboard').then(m => ({ default: m.GlobalDashboard })));
const CampaignBuilder    = lazy(() => import('../../../modules/campaigns/frontend/components/CampaignBuilder').then(m => ({ default: m.CampaignBuilder })));
const AnalyticsDashboard = lazy(() => import('../../../modules/analytics/frontend/components/AnalyticsDashboard').then(m => ({ default: m.AnalyticsDashboard })));
const AnalyticsPage      = lazy(() => import('../../../modules/analytics/frontend/pages/AnalyticsPage'));

// ── Auth (Users module) ───────────────────────────────────────────
const LoginPage    = lazy(() => import('../../../modules/users/frontend/pages/LoginPage'));
const RegisterPage = lazy(() => import('../../../modules/users/frontend/pages/RegisterPage'));

// ── WhatsApp ──────────────────────────────────────────────────────
const WhatsAppDashboard = lazy(() => import('../../../modules/whatsapp/frontend/pages/WhatsAppDashboard'));
const WhatsAppInbox     = lazy(() => import('../../../modules/whatsapp/frontend/pages/WhatsAppInbox'));

// ── SMS ───────────────────────────────────────────────────────────
const SMSDashboard        = lazy(() => import('../../../modules/sms/frontend/pages/SMSDashboard'));
const SMSInbox            = lazy(() => import('../../../modules/sms/frontend/pages/SMSInbox'));
const SMSProviderSettings = lazy(() => import('../../../modules/sms/frontend/pages/SMSProviderSettings'));
const SMSAnalyticsPage    = lazy(() => import('../../../modules/sms/frontend/pages/SMSAnalyticsPage'));

// ── Email ─────────────────────────────────────────────────────────
const EmailDashboard = lazy(() => import('../../../modules/email/frontend/pages/EmailDashboard'));
const EmailInbox     = lazy(() => import('../../../modules/email/frontend/pages/EmailInbox'));

// ── Telegram ──────────────────────────────────────────────────────
const TelegramDashboard = lazy(() => import('../../../modules/telegram/frontend/pages/TelegramDashboard'));
const TelegramInbox     = lazy(() => import('../../../modules/telegram/frontend/pages/TelegramInbox'));

// ── Messenger ─────────────────────────────────────────────────────
const MessengerDashboard = lazy(() => import('../../../modules/messenger/frontend/pages/MessengerDashboard'));
const MessengerInbox     = lazy(() => import('../../../modules/messenger/frontend/pages/MessengerInbox'));

// ── Inbox ─────────────────────────────────────────────────────────
const InboxDashboard = lazy(() => import('../../../modules/inbox/frontend/pages/InboxDashboard'));

// ── Leads ─────────────────────────────────────────────────────────
const LeadsPage = lazy(() => import('../../../modules/leads/frontend/pages/LeadsPage'));

// ── Automation ────────────────────────────────────────────────────
const AutomationRules = lazy(() => import('../../../modules/automation/frontend/pages/AutomationRules'));

// ── Campaigns ─────────────────────────────────────────────────────
const TemplatesPage = lazy(() => import('../../../modules/campaigns/frontend/pages/TemplatesPage'));
const PlaceholderPage = lazy(() => import('../../../packages/ui/src/components/shared/PlaceholderPage'));

// ── Billing ───────────────────────────────────────────────────────
const ClientsPage = lazy(() => import('../../../modules/billing/frontend/pages/ClientsPage'));
const BillingPage = lazy(() => import('../../../modules/billing/frontend/pages/BillingPage'));
const PaymentPage = lazy(() => import('../../../modules/billing/frontend/pages/PaymentPage'));

// ── E-commerce ────────────────────────────────────────────────────
const CartRecoveryPage = lazy(() => import('../../../modules/ecommerce/frontend/pages/CartRecoveryPage'));

// ── Products ──────────────────────────────────────────────────────
const ProductDashboardPage = lazy(() => import('../../../modules/products/frontend/pages/ProductDashboardPage'));
const FunnelPage           = lazy(() => import('../../../modules/products/frontend/pages/FunnelPage'));
const AppointmentPage      = lazy(() => import('../../../modules/products/frontend/pages/AppointmentPage'));
const PaymentBotPage       = lazy(() => import('../../../modules/products/frontend/pages/PaymentBotPage'));
const ReviewCollectorPage  = lazy(() => import('../../../modules/products/frontend/pages/ReviewCollectorPage'));
const EventReminderPage    = lazy(() => import('../../../modules/products/frontend/pages/EventReminderPage'));
const CatalogBotPage       = lazy(() => import('../../../modules/products/frontend/pages/CatalogBotPage'));
const SurveyBotPage        = lazy(() => import('../../../modules/products/frontend/pages/SurveyBotPage'));
const MembershipBotPage    = lazy(() => import('../../../modules/products/frontend/pages/MembershipBotPage'));

// ── Instagram ─────────────────────────────────────────────────────
const InstagramDashboard         = lazy(() => import('../../../modules/instagram/frontend/pages/InstagramDashboard'));
const InstagramInbox             = lazy(() => import('../../../modules/instagram/frontend/pages/InstagramInbox'));
const InstagramCommentAutomation = lazy(() => import('../../../modules/instagram/frontend/pages/InstagramCommentAutomation'));
const InstagramStoryAutomation   = lazy(() => import('../../../modules/instagram/frontend/pages/InstagramStoryAutomation'));
const InstagramLeadBot           = lazy(() => import('../../../modules/instagram/frontend/pages/InstagramLeadBot'));
const InstagramContentStudio     = lazy(() => import('../../../modules/instagram/frontend/pages/InstagramContentStudio'));
const InstagramAnalytics         = lazy(() => import('../../../modules/instagram/frontend/pages/InstagramAnalytics'));

// ── Growth ────────────────────────────────────────────────────────
const GrowthDashboardPage = lazy(() => import('../../../modules/growth/frontend/pages/GrowthDashboardPage'));
const LeadCapturePage     = lazy(() => import('../../../modules/growth/frontend/pages/LeadCapturePage'));
const MissedCallPage      = lazy(() => import('../../../modules/growth/frontend/pages/MissedCallPage'));
const FollowupsPage       = lazy(() => import('../../../modules/growth/frontend/pages/FollowupsPage'));
const LoyaltyPage         = lazy(() => import('../../../modules/growth/frontend/pages/LoyaltyPage'));
const ReferralPage        = lazy(() => import('../../../modules/growth/frontend/pages/ReferralPage'));
const ReviewBoosterPage   = lazy(() => import('../../../modules/growth/frontend/pages/ReviewBoosterPage'));
const PipelinePage        = lazy(() => import('../../../modules/growth/frontend/pages/PipelinePage'));
const BroadcastPage       = lazy(() => import('../../../modules/growth/frontend/pages/BroadcastPage'));
const AdsTrackerPage      = lazy(() => import('../../../modules/growth/frontend/pages/AdsTrackerPage'));
const WebsiteBuilderPage  = lazy(() => import('../../../modules/growth/frontend/pages/WebsiteBuilderPage'));

// ── WA-SaaS ───────────────────────────────────────────────────────
const WaSaasDashboardPage    = lazy(() => import('../../../modules/wa-saas/frontend/pages/WaSaasDashboardPage'));
const DripMarketingPage      = lazy(() => import('../../../modules/wa-saas/frontend/pages/DripMarketingPage'));
const AiBotPage              = lazy(() => import('../../../modules/wa-saas/frontend/pages/AiBotPage'));
const OrderTrackingPage      = lazy(() => import('../../../modules/wa-saas/frontend/pages/OrderTrackingPage'));
const SubscriptionBotPage    = lazy(() => import('../../../modules/wa-saas/frontend/pages/SubscriptionBotPage'));
const FlashSalePage          = lazy(() => import('../../../modules/wa-saas/frontend/pages/FlashSalePage'));
const TeamInboxPage          = lazy(() => import('../../../modules/wa-saas/frontend/pages/TeamInboxPage'));
const LinkTrackingPage       = lazy(() => import('../../../modules/wa-saas/frontend/pages/LinkTrackingPage'));
const ReengagementPage       = lazy(() => import('../../../modules/wa-saas/frontend/pages/ReengagementPage'));
const BroadcastOptimizerPage = lazy(() => import('../../../modules/wa-saas/frontend/pages/BroadcastOptimizerPage'));
const BusinessCardPage       = lazy(() => import('../../../modules/wa-saas/frontend/pages/BusinessCardPage'));


// ── WA Chat ───────────────────────────────────────────────────────
const WhatsAppChatPage     = lazy(() => import('../../../modules/wa-chat/frontend/pages/WhatsAppChatPage'));
const WhatsAppChatSettings = lazy(() => import('../../../modules/wa-chat/frontend/pages/WhatsAppChatSettings'));

// ── Skeleton fallback ─────────────────────────────────────────────
function PageSkeleton() {
  return (
    <div className="space-y-4">
      <div className="h-8 w-48 rounded-lg skeleton" />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-28 rounded-xl skeleton" />
        ))}
      </div>
      <div className="h-64 rounded-xl skeleton" />
    </div>
  );
}

export default function App() {
  useRealtimeEvents();
  const { sidebarOpen, toggleSidebar } = useAppStore();
  const { isAuthenticated, isLoading, initialize } = useAuthStore();

  useEffect(() => { initialize(); }, [initialize]);
  const handleMenuClick = useCallback(() => toggleSidebar(), [toggleSidebar]);

  if (isLoading) return <div className="min-h-screen bg-surface-root" />;

  if (!isAuthenticated) {
    return (
      <Suspense fallback={<div className="min-h-screen bg-surface-root" />}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </Suspense>
    );
  }

  return (
    <div className="min-h-screen flex bg-[var(--bg-root)] text-[var(--text-primary)]">
      {sidebarOpen && (
        <div className="fixed inset-0 bg-[var(--bg-overlay)] z-20 md:hidden" onClick={toggleSidebar} aria-hidden="true" />
      )}
      <Sidebar />
      <main className="flex-1 min-w-0 flex flex-col transition-[margin] duration-[220ms] ease-in-out"
            style={{ marginLeft: sidebarOpen ? 248 : 64 }}>
        <Topbar onMenuClick={handleMenuClick} />
        <div className="flex-1 p-4 md:p-6 max-w-7xl mx-auto w-full">
          <PageErrorBoundary>
          <Suspense fallback={<PageSkeleton />}>
            <Routes>
              <Route path="/login" element={<Navigate to="/" replace />} />
              <Route path="/register" element={<Navigate to="/" replace />} />

              {/* Core */}
              <Route path="/" element={<GlobalDashboard />} />
              <Route path="/leads" element={<LeadsPage />} />

              {/* WhatsApp */}
              <Route path="/whatsapp" element={<WhatsAppDashboard />} />
              <Route path="/whatsapp/campaigns" element={<CampaignBuilder />} />
              <Route path="/whatsapp/numbers" element={<PlaceholderPage title="WhatsApp Numbers" />} />
              <Route path="/whatsapp/templates" element={<TemplatesPage />} />
              <Route path="/whatsapp/analytics" element={<AnalyticsDashboard />} />

              {/* SMS */}
              <Route path="/sms" element={<SMSDashboard />} />
              <Route path="/sms/campaigns" element={<CampaignBuilder />} />
              <Route path="/sms/providers" element={<SMSProviderSettings />} />
              <Route path="/sms/analytics" element={<SMSAnalyticsPage />} />

              {/* Email */}
              <Route path="/email" element={<EmailDashboard />} />
              <Route path="/email/campaigns" element={<CampaignBuilder />} />
              <Route path="/email/templates" element={<PlaceholderPage title="Email Templates" />} />
              <Route path="/email/analytics" element={<AnalyticsDashboard />} />

              {/* Telegram */}
              <Route path="/telegram" element={<TelegramDashboard />} />
              <Route path="/telegram/campaigns" element={<CampaignBuilder />} />
              <Route path="/telegram/bots" element={<PlaceholderPage title="Telegram Bots" />} />
              <Route path="/telegram/analytics" element={<AnalyticsDashboard />} />

              {/* Messenger */}
              <Route path="/messenger" element={<MessengerDashboard />} />
              <Route path="/messenger/campaigns" element={<CampaignBuilder />} />
              <Route path="/messenger/analytics" element={<AnalyticsDashboard />} />

              {/* Inboxes */}
              <Route path="/inbox" element={<InboxDashboard />} />
              <Route path="/inbox/whatsapp" element={<WhatsAppInbox />} />
              <Route path="/inbox/sms" element={<SMSInbox />} />
              <Route path="/inbox/email" element={<EmailInbox />} />
              <Route path="/inbox/telegram" element={<TelegramInbox />} />
              <Route path="/inbox/messenger" element={<MessengerInbox />} />

              {/* Automation & Analytics */}
              <Route path="/automation" element={<AutomationRules />} />
              <Route path="/analytics" element={<AnalyticsPage />} />

              {/* Billing */}
              <Route path="/billing" element={<BillingPage />} />
              <Route path="/billing/payment" element={<PaymentPage />} />
              <Route path="/cart-recovery" element={<CartRecoveryPage />} />

              {/* Products */}
              <Route path="/products" element={<ProductDashboardPage />} />
              <Route path="/products/funnel" element={<FunnelPage />} />
              <Route path="/products/appointments" element={<AppointmentPage />} />
              <Route path="/products/payment-bot" element={<PaymentBotPage />} />
              <Route path="/products/reviews" element={<ReviewCollectorPage />} />
              <Route path="/products/events" element={<EventReminderPage />} />
              <Route path="/products/catalog" element={<CatalogBotPage />} />
              <Route path="/products/surveys" element={<SurveyBotPage />} />
              <Route path="/products/memberships" element={<MembershipBotPage />} />

              {/* Instagram */}
              <Route path="/instagram" element={<InstagramDashboard />} />
              <Route path="/instagram/inbox" element={<InstagramInbox />} />
              <Route path="/instagram/comment-automation" element={<InstagramCommentAutomation />} />
              <Route path="/instagram/story-automation" element={<InstagramStoryAutomation />} />
              <Route path="/instagram/lead-bot" element={<InstagramLeadBot />} />
              <Route path="/instagram/content" element={<InstagramContentStudio />} />
              <Route path="/instagram/analytics" element={<InstagramAnalytics />} />

              {/* Growth */}
              <Route path="/growth" element={<GrowthDashboardPage />} />
              <Route path="/growth/lead-capture" element={<LeadCapturePage />} />
              <Route path="/growth/missed-call" element={<MissedCallPage />} />
              <Route path="/growth/followups" element={<FollowupsPage />} />
              <Route path="/growth/loyalty" element={<LoyaltyPage />} />
              <Route path="/growth/referral" element={<ReferralPage />} />
              <Route path="/growth/review-booster" element={<ReviewBoosterPage />} />
              <Route path="/growth/pipeline" element={<PipelinePage />} />
              <Route path="/growth/broadcast" element={<BroadcastPage />} />
              <Route path="/growth/ads" element={<AdsTrackerPage />} />
              <Route path="/growth/websites" element={<WebsiteBuilderPage />} />

              {/* WA-SaaS */}
              <Route path="/wa-saas" element={<WaSaasDashboardPage />} />
              <Route path="/wa-saas/drip" element={<DripMarketingPage />} />
              <Route path="/wa-saas/ai-bot" element={<AiBotPage />} />
              <Route path="/wa-saas/orders" element={<OrderTrackingPage />} />
              <Route path="/wa-saas/subscriptions" element={<SubscriptionBotPage />} />
              <Route path="/wa-saas/flash-sales" element={<FlashSalePage />} />
              <Route path="/wa-saas/team-inbox" element={<TeamInboxPage />} />
              <Route path="/wa-saas/links" element={<LinkTrackingPage />} />
              <Route path="/wa-saas/reengagement" element={<ReengagementPage />} />
              <Route path="/wa-saas/broadcast-opt" element={<BroadcastOptimizerPage />} />
              <Route path="/wa-saas/business-cards" element={<BusinessCardPage />} />


              {/* WA Chat */}
              <Route path="/wa-chat" element={<WhatsAppChatPage />} />
              <Route path="/wa-chat/settings" element={<WhatsAppChatSettings />} />

              {/* Legacy compat */}
              <Route path="/campaigns/new" element={<CampaignBuilder />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
          </PageErrorBoundary>
        </div>
      </main>
    </div>
  );
}
