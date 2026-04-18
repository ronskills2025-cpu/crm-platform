/**
 * apps/admin/src/App.tsx — Modular Admin Entry Point
 *
 * Imports admin pages from @modules/users and @modules/campaigns.
 */

import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import { useAuthStore } from '../../../modules/users/admin/stores/authStore';
import AdminLayout from '../../../packages/ui/src/components/layout/AdminLayout';

// ── Admin pages from modules ──────────────────────────────────────
import LoginPage from '../../../modules/users/admin/pages/LoginPage';
import OverviewPage from '../../../modules/users/admin/pages/OverviewPage';
import UsersPage from '../../../modules/users/admin/pages/UsersPage';
import ProvidersPage from '../../../modules/users/admin/pages/ProvidersPage';
import ChannelConfigPage from '../../../modules/users/admin/pages/ChannelConfigPage';
import CampaignsPage from '../../../modules/campaigns/admin/pages/CampaignsPage';
const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false },
  },
});

function AuthInit({ children }: { children: React.ReactNode }) {
  const initialize = useAuthStore((s) => s.initialize);
  useEffect(() => { initialize(); }, [initialize]);
  return <>{children}</>;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthInit>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route element={<AdminLayout />}>
              <Route index element={<OverviewPage />} />
              <Route path="users" element={<UsersPage />} />
              <Route path="providers" element={<ProvidersPage />} />
              <Route path="channels" element={<ChannelConfigPage />} />
              <Route path="campaigns" element={<CampaignsPage />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AuthInit>
      </BrowserRouter>
      <Toaster position="top-right" toastOptions={{
        className: 'bg-surface-elevated text-white border border-white/10',
      }} />
    </QueryClientProvider>
  );
}
