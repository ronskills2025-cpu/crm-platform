import { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  AreaChart, Area,
  BarChart, Bar,
  LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import {
  Users, TrendingUp, BarChart2, MessageSquare,
  DollarSign, Zap, RefreshCw, ChevronDown,
} from 'lucide-react';
import { analyticsApi } from '../analytics.api';
import { formatCurrency, formatNumber } from '../../../../packages/utils/src/frontend-utils';

// ── Types ────────────────────────────────────────────────────────────────────

interface ChannelRow {
  channel: string;
  sent: number;
  delivered: number;
  failed: number;
  extra: number;
  cost: number;
  delivery_rate: number;
}

interface CampaignRow {
  id: string;
  name: string;
  channel: string;
  status: string;
  sent_count: number;
  delivered_count: number;
  failed_count: number;
  delivery_rate: number;
}

// ── Constants ────────────────────────────────────────────────────────────────

const CHANNEL_COLORS: Record<string, string> = {
  whatsapp: '#25D366',
  sms: '#6366f1',
  email: '#f59e0b',
  telegram: '#0088cc',
  messenger: '#0084FF',
  instagram: '#E1306C',
};

const PRESETS = [
  { label: 'Today',   days: 0 },
  { label: '7 days',  days: 7 },
  { label: '30 days', days: 30 },
  { label: 'Custom',  days: -1 },
];

const ALL_CHANNELS = ['', 'whatsapp', 'sms', 'email', 'telegram', 'messenger', 'instagram'];

// ── Helpers ──────────────────────────────────────────────────────────────────

function toISODate(d: Date) { return d.toISOString().split('T')[0]; }

function presetDates(days: number): { from: string; to: string } {
  const to   = new Date();
  const from = new Date();
  if (days === 0) {
    from.setHours(0, 0, 0, 0);
  } else {
    from.setDate(from.getDate() - days);
  }
  return { from: toISODate(from), to: toISODate(to) };
}

// ── Skeleton card ────────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm animate-pulse">
      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2 mb-3" />
      <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-2" />
      <div className="h-3 bg-gray-100 dark:bg-gray-700 rounded w-1/3" />
    </div>
  );
}

// ── Stat card ────────────────────────────────────────────────────────────────

interface StatCardProps {
  title: string;
  value: string;
  sub?: string;
  icon: React.ReactNode;
  color: string;
}

function StatCard({ title, value, sub, icon, color }: StatCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-100 dark:border-gray-700"
    >
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">{title}</p>
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${color}`}>
          {icon}
        </div>
      </div>
      <p className="text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
      {sub && <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{sub}</p>}
    </motion.div>
  );
}

// ── Channel badge ─────────────────────────────────────────────────────────────

function ChannelBadge({ channel }: { channel: string }) {
  const color = CHANNEL_COLORS[channel] ?? '#6b7280';
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium text-white"
      style={{ backgroundColor: color }}
    >
      {channel}
    </span>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function AnalyticsPage() {
  const queryClient = useQueryClient();

  // ── Filter state ───────────────────────────────────────────────────────────
  const [preset,         setPreset]         = useState(2);   // 30 days default
  const [customFrom,     setCustomFrom]     = useState('');
  const [customTo,       setCustomTo]       = useState('');
  const [channelFilter,  setChannelFilter]  = useState('');

  const isCustom = PRESETS[preset].days === -1;

  // Resolved date range
  const dateRange = useMemo(() => {
    if (isCustom && customFrom && customTo) return { from: customFrom, to: customTo };
    return presetDates(PRESETS[preset].days);
  }, [preset, isCustom, customFrom, customTo]);

  const filters = useMemo(() => ({
    from: dateRange.from,
    to:   dateRange.to,
    ...(channelFilter ? { channel: channelFilter } : {}),
  }), [dateRange, channelFilter]);

  // ── Queries ────────────────────────────────────────────────────────────────

  const { data: summary, isLoading, isError } = useQuery({
    queryKey: ['analytics-summary', filters],
    queryFn:  () => analyticsApi.getSummary(filters),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  const { data: leadsData } = useQuery({
    queryKey: ['analytics-leads', filters],
    queryFn:  () => analyticsApi.getLeads(filters),
    staleTime: 30_000,
  });

  const { data: campaignsData } = useQuery({
    queryKey: ['analytics-campaigns', filters],
    queryFn:  () => analyticsApi.getCampaigns(filters),
    staleTime: 30_000,
  });

  const { data: revenueData } = useQuery({
    queryKey: ['analytics-revenue', filters],
    queryFn:  () => analyticsApi.getRevenue(filters),
    staleTime: 30_000,
  });

  // Real-time invalidation via polling (refetchInterval on queries above handles this)

  // ── Derived values ─────────────────────────────────────────────────────────

  const leads      = summary?.leads      ?? leadsData;
  const campaigns  = summary?.campaigns  ?? campaignsData;
  const channels   = (summary?.channels  ?? []) as ChannelRow[];
  const revenue    = summary?.revenue    ?? revenueData;
  const automation = summary?.automation ?? { total: 0, succeeded: 0, failed: 0, success_rate: 0 };

  const totalMessages = channels.reduce((s: number, c: ChannelRow) => s + c.sent, 0);
  const totalDelivered = channels.reduce((s: number, c: ChannelRow) => s + c.delivered, 0);
  const overallDelivery = totalMessages > 0
    ? Math.round((totalDelivered / totalMessages) * 10000) / 100
    : 0;

  return (
    <div className="p-6 space-y-6 max-w-screen-xl mx-auto">

      {/* ── Header ───────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Analytics</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Real-time data across all modules
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">

          {/* Date presets */}
          <div className="flex rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700">
            {PRESETS.map((p, i) => (
              <button
                key={p.label}
                onClick={() => setPreset(i)}
                className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                  preset === i
                    ? 'bg-indigo-600 text-white'
                    : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Custom date pickers */}
          {isCustom && (
            <>
              <input
                type="date"
                value={customFrom}
                onChange={e => setCustomFrom(e.target.value)}
                className="text-sm border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-1.5 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200"
              />
              <span className="text-gray-400 text-sm">→</span>
              <input
                type="date"
                value={customTo}
                onChange={e => setCustomTo(e.target.value)}
                className="text-sm border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-1.5 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200"
              />
            </>
          )}

          {/* Channel filter */}
          <div className="relative">
            <select
              value={channelFilter}
              onChange={e => setChannelFilter(e.target.value)}
              className="appearance-none text-sm border border-gray-200 dark:border-gray-700 rounded-lg pl-3 pr-8 py-1.5 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200"
            >
              <option value="">All channels</option>
              {ALL_CHANNELS.filter(Boolean).map(ch => (
                <option key={ch} value={ch}>{ch}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-2 top-2 w-4 h-4 text-gray-400 pointer-events-none" />
          </div>

          {/* Refresh */}
          <button
            onClick={() => {
              queryClient.invalidateQueries({ queryKey: ['analytics-summary'] });
              queryClient.invalidateQueries({ queryKey: ['analytics-leads'] });
              queryClient.invalidateQueries({ queryKey: ['analytics-campaigns'] });
              queryClient.invalidateQueries({ queryKey: ['analytics-revenue'] });
            }}
            className="p-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4 text-gray-500" />
          </button>
        </div>
      </div>

      {/* ── Error state ───────────────────────────────────────────────────── */}
      {isError && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 text-red-700 dark:text-red-400 text-sm">
          Failed to load analytics data. Check that the backend is running.
        </div>
      )}

      {/* ── Overview cards ────────────────────────────────────────────────── */}
      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          <StatCard
            title="Total Leads"
            value={formatNumber(leads?.total ?? 0)}
            sub={`${leads?.new_today ?? 0} new today`}
            icon={<Users className="w-5 h-5 text-white" />}
            color="bg-indigo-500"
          />
          <StatCard
            title="Conversion Rate"
            value={`${leads?.conversion_rate ?? 0}%`}
            sub={`${leads?.converted ?? 0} converted`}
            icon={<TrendingUp className="w-5 h-5 text-white" />}
            color="bg-emerald-500"
          />
          <StatCard
            title="Campaigns"
            value={formatNumber(campaigns?.total ?? 0)}
            sub={`${campaigns?.running ?? 0} running`}
            icon={<BarChart2 className="w-5 h-5 text-white" />}
            color="bg-violet-500"
          />
          <StatCard
            title="Messages Sent"
            value={formatNumber(totalMessages)}
            sub={`${overallDelivery}% delivery`}
            icon={<MessageSquare className="w-5 h-5 text-white" />}
            color="bg-blue-500"
          />
          <StatCard
            title="Revenue"
            value={formatCurrency(revenue?.total_revenue ?? 0)}
            sub={`${revenue?.success_count ?? 0} payments`}
            icon={<DollarSign className="w-5 h-5 text-white" />}
            color="bg-amber-500"
          />
          <StatCard
            title="Automation"
            value={`${automation.success_rate}%`}
            sub={`${formatNumber(automation.total)} runs`}
            icon={<Zap className="w-5 h-5 text-white" />}
            color="bg-rose-500"
          />
        </div>
      )}

      {/* ── Charts row ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Leads trend */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-100 dark:border-gray-700">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">Leads over time</h3>
          {isLoading ? (
            <div className="h-48 bg-gray-100 dark:bg-gray-700 rounded animate-pulse" />
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={leads?.trend ?? []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={d => d.slice(5)} />
                <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                <Tooltip />
                <Area type="monotone" dataKey="count" stroke="#6366f1" fill="#6366f120" strokeWidth={2} name="Leads" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Revenue trend */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-100 dark:border-gray-700">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">Revenue trend</h3>
          {isLoading ? (
            <div className="h-48 bg-gray-100 dark:bg-gray-700 rounded animate-pulse" />
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={revenue?.trend ?? []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={d => d.slice(5)} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip formatter={(v: number) => formatCurrency(v)} />
                <Area type="monotone" dataKey="revenue" stroke="#f59e0b" fill="#f59e0b20" strokeWidth={2} name="Revenue" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Campaign messages bar chart */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-100 dark:border-gray-700">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">Campaign message volume</h3>
        {isLoading ? (
          <div className="h-52 bg-gray-100 dark:bg-gray-700 rounded animate-pulse" />
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={campaigns?.trend ?? []}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={d => d.slice(5)} />
              <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
              <Tooltip />
              <Legend />
              <Bar dataKey="sent"      fill="#6366f1" name="Sent"      radius={[2,2,0,0]} />
              <Bar dataKey="delivered" fill="#10b981" name="Delivered" radius={[2,2,0,0]} />
              <Bar dataKey="failed"    fill="#ef4444" name="Failed"    radius={[2,2,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* ── Tables row ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Top campaigns */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Top campaigns</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-900/40">
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Name</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Channel</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">Sent</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">Delivered</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">Rate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {isLoading ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <tr key={i}>
                      {Array.from({ length: 5 }).map((__, j) => (
                        <td key={j} className="px-4 py-3">
                          <div className="h-3 bg-gray-100 dark:bg-gray-700 rounded animate-pulse" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : (campaigns?.top_campaigns ?? []).length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-center text-gray-400 text-xs">No campaigns in this period</td>
                  </tr>
                ) : (
                  (campaigns?.top_campaigns ?? [] as CampaignRow[]).map((c: CampaignRow) => (
                    <tr key={c.id} className="hover:bg-gray-50 dark:hover:bg-gray-900/30 transition-colors">
                      <td className="px-4 py-3 font-medium text-gray-800 dark:text-gray-200 max-w-[140px] truncate">{c.name}</td>
                      <td className="px-4 py-3"><ChannelBadge channel={c.channel} /></td>
                      <td className="px-4 py-3 text-right text-gray-600 dark:text-gray-400">{formatNumber(c.sent_count)}</td>
                      <td className="px-4 py-3 text-right text-gray-600 dark:text-gray-400">{formatNumber(c.delivered_count)}</td>
                      <td className="px-4 py-3 text-right">
                        <span className={`font-medium ${c.delivery_rate >= 80 ? 'text-emerald-600 dark:text-emerald-400' : c.delivery_rate >= 50 ? 'text-amber-600' : 'text-red-500'}`}>
                          {c.delivery_rate}%
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Channel breakdown */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Channel breakdown</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-900/40">
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Channel</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">Sent</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">Delivered</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">Failed</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">Cost</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">Rate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {isLoading ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <tr key={i}>
                      {Array.from({ length: 6 }).map((__, j) => (
                        <td key={j} className="px-4 py-3">
                          <div className="h-3 bg-gray-100 dark:bg-gray-700 rounded animate-pulse" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : (
                  channels.filter((c: ChannelRow) => c.sent > 0 || !channelFilter).map((c: ChannelRow) => (
                    <tr key={c.channel} className="hover:bg-gray-50 dark:hover:bg-gray-900/30 transition-colors">
                      <td className="px-4 py-3"><ChannelBadge channel={c.channel} /></td>
                      <td className="px-4 py-3 text-right text-gray-600 dark:text-gray-400">{formatNumber(c.sent)}</td>
                      <td className="px-4 py-3 text-right text-gray-600 dark:text-gray-400">{formatNumber(c.delivered)}</td>
                      <td className="px-4 py-3 text-right text-red-500">{formatNumber(c.failed)}</td>
                      <td className="px-4 py-3 text-right text-gray-600 dark:text-gray-400">{formatCurrency(c.cost)}</td>
                      <td className="px-4 py-3 text-right">
                        <span className={`font-medium ${c.delivery_rate >= 80 ? 'text-emerald-600 dark:text-emerald-400' : c.delivery_rate >= 50 ? 'text-amber-600' : 'text-red-500'}`}>
                          {c.delivery_rate}%
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ── Leads by channel + automation row ────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">

        {/* Leads by channel */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-100 dark:border-gray-700">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">Leads by channel</h3>
          {isLoading ? (
            <div className="h-40 bg-gray-100 dark:bg-gray-700 rounded animate-pulse" />
          ) : (
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={leads?.by_channel ?? []} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis type="number" tick={{ fontSize: 10 }} allowDecimals={false} />
                <YAxis dataKey="channel" type="category" tick={{ fontSize: 10 }} width={70} />
                <Tooltip />
                <Bar dataKey="count" radius={[0,4,4,0]} name="Leads">
                  {(leads?.by_channel ?? []).map((entry: { channel: string }) => (
                    <rect key={entry.channel} fill={CHANNEL_COLORS[entry.channel] ?? '#6366f1'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Automation stats */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-100 dark:border-gray-700">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">Automation</h3>
          <div className="space-y-3">
            {[
              { label: 'Total runs',  value: formatNumber(automation.total),     color: 'text-gray-800 dark:text-white' },
              { label: 'Succeeded',   value: formatNumber(automation.succeeded), color: 'text-emerald-600 dark:text-emerald-400' },
              { label: 'Failed',      value: formatNumber(automation.failed),    color: 'text-red-500' },
              { label: 'Success rate',value: `${automation.success_rate}%`,      color: automation.success_rate >= 80 ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600' },
            ].map(row => (
              <div key={row.label} className="flex justify-between items-center">
                <span className="text-sm text-gray-500 dark:text-gray-400">{row.label}</span>
                <span className={`text-sm font-semibold ${row.color}`}>{row.value}</span>
              </div>
            ))}
            {automation.total > 0 && (
              <div className="mt-2">
                <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-2">
                  <div
                    className="bg-emerald-500 h-2 rounded-full transition-all"
                    style={{ width: `${Math.min(automation.success_rate, 100)}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Message cost breakdown */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-100 dark:border-gray-700">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">Message costs</h3>
          <div className="space-y-3">
            {[
              { label: 'WhatsApp', value: revenue?.message_costs?.whatsapp ?? 0 },
              { label: 'SMS',      value: revenue?.message_costs?.sms ?? 0 },
              { label: 'Email',    value: revenue?.message_costs?.email ?? 0 },
            ].map(row => (
              <div key={row.label} className="flex justify-between items-center">
                <span className="text-sm text-gray-500 dark:text-gray-400">{row.label}</span>
                <span className="text-sm font-semibold text-gray-800 dark:text-white">{formatCurrency(row.value)}</span>
              </div>
            ))}
            <div className="pt-2 border-t border-gray-100 dark:border-gray-700 flex justify-between items-center">
              <span className="text-sm font-medium text-gray-600 dark:text-gray-300">Total</span>
              <span className="text-sm font-bold text-gray-900 dark:text-white">
                {formatCurrency(revenue?.total_message_cost ?? 0)}
              </span>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}
