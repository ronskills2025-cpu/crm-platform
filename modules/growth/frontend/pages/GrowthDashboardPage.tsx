import { useEffect, useState } from 'react';
import { BarChart3, TrendingUp, Users, Target, Zap, DollarSign, Star, Globe } from 'lucide-react';
import { growthApi } from '../../../../packages/ui/src/services/api';

interface OverviewStats {
  lead_capture: { total_forms: number; total_submissions: number };
  missed_call: { total_configs: number; total_calls: number };
  followup: { total_sequences: number; active_enrollments: number };
  loyalty: { total_programs: number; total_members: number };
  referral: { total_programs: number; total_referrals: number };
  review_booster: { total_campaigns: number; total_requests: number };
  pipeline: { total_pipelines: number; total_deals: number };
  broadcast: { total_segments: number; total_campaigns: number };
  ads: { total_campaigns: number; total_conversions: number };
  websites: { total_sites: number; published: number };
}

export default function GrowthDashboardPage() {
  const [stats, setStats] = useState<OverviewStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    growthApi.getDashboard()
      .then((d: { stats: OverviewStats }) => setStats(d.stats))
      .catch(() => setStats(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600" /></div>;

  if (!stats) return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold flex items-center gap-2"><BarChart3 className="w-6 h-6 text-brand-600" /> Growth Dashboard</h1>
      <div className="card p-8 text-center">
        <BarChart3 className="w-10 h-10 mx-auto mb-3 text-gray-400" />
        <p className="text-gray-500">No data available yet. Start using Growth tools to see stats here.</p>
      </div>
    </div>
  );

  const cards = stats ? [
    { label: 'Lead Forms', value: stats.lead_capture.total_forms, sub: `${stats.lead_capture.total_submissions} submissions`, icon: Target, color: 'text-blue-500' },
    { label: 'Missed Calls', value: stats.missed_call.total_calls, sub: `${stats.missed_call.total_configs} configs`, icon: Zap, color: 'text-red-500' },
    { label: 'Follow-Ups', value: stats.followup.active_enrollments, sub: `${stats.followup.total_sequences} sequences`, icon: TrendingUp, color: 'text-emerald-500' },
    { label: 'Loyalty Members', value: stats.loyalty.total_members, sub: `${stats.loyalty.total_programs} programs`, icon: Star, color: 'text-amber-500' },
    { label: 'Referrals', value: stats.referral.total_referrals, sub: `${stats.referral.total_programs} programs`, icon: Users, color: 'text-purple-500' },
    { label: 'Review Requests', value: stats.review_booster.total_requests, sub: `${stats.review_booster.total_campaigns} campaigns`, icon: Star, color: 'text-yellow-500' },
    { label: 'Pipeline Deals', value: stats.pipeline.total_deals, sub: `${stats.pipeline.total_pipelines} pipelines`, icon: DollarSign, color: 'text-green-500' },
    { label: 'Broadcasts', value: stats.broadcast.total_campaigns, sub: `${stats.broadcast.total_segments} segments`, icon: BarChart3, color: 'text-indigo-500' },
    { label: 'Ad Conversions', value: stats.ads.total_conversions, sub: `${stats.ads.total_campaigns} campaigns`, icon: TrendingUp, color: 'text-pink-500' },
    { label: 'Websites', value: stats.websites.published, sub: `${stats.websites.total_sites} total`, icon: Globe, color: 'text-cyan-500' },
  ] : [];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold flex items-center gap-2"><BarChart3 className="w-6 h-6 text-brand-600" /> Growth Dashboard</h1>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {cards.map((c) => (
          <div key={c.label} className="rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-4">
            <div className="flex items-center gap-2 text-sm text-gray-500 mb-1"><c.icon className={`w-4 h-4 ${c.color}`} /> {c.label}</div>
            <p className="text-2xl font-bold">{c.value}</p>
            <p className="text-xs text-gray-400 mt-1">{c.sub}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
