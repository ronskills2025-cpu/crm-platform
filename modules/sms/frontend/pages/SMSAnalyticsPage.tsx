import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { BarChart3, TrendingUp, DollarSign, Globe, Activity } from 'lucide-react';
import { smsApi } from '../../../../packages/ui/src/services/api';
import { cn } from '../../../../packages/utils/src/frontend-utils';

type Tab = 'overview' | 'providers' | 'regions' | 'cost';

export default function SMSAnalyticsPage() {
  const [tab, setTab] = useState<Tab>('overview');
  const [days, setDays] = useState(7);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-white">SMS Analytics</h1>
          <p className="text-sm text-gray-400 mt-1">Delivery rates, cost tracking, and provider performance</p>
        </div>
        <select value={days} onChange={(e) => setDays(Number(e.target.value))} className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm">
          <option value={7}>Last 7 days</option>
          <option value={14}>Last 14 days</option>
          <option value={30}>Last 30 days</option>
          <option value={90}>Last 90 days</option>
        </select>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-1 bg-gray-800/50 p-1 rounded-lg border border-gray-700">
        {([
          { key: 'overview' as Tab, label: 'Overview', icon: Activity },
          { key: 'providers' as Tab, label: 'Providers', icon: BarChart3 },
          { key: 'regions' as Tab, label: 'Regions', icon: Globe },
          { key: 'cost' as Tab, label: 'Cost', icon: DollarSign },
        ]).map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors',
              tab === t.key ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-700/50'
            )}
          >
            <t.icon className="w-4 h-4" />
            {t.label}
          </button>
        ))}
      </div>

      <motion.div key={tab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        {tab === 'overview' && <OverviewTab days={days} />}
        {tab === 'providers' && <ProvidersTab days={days} />}
        {tab === 'regions' && <RegionsTab days={days} />}
        {tab === 'cost' && <CostTab days={days} />}
      </motion.div>
    </div>
  );
}

function StatsCard({ label, value, sub, icon: Icon, color }: { label: string; value: string | number; sub?: string; icon: typeof Activity; color: string }) {
  return (
    <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-5">
      <div className="flex justify-between items-start">
        <div>
          <p className="text-sm text-gray-400">{label}</p>
          <p className="text-2xl font-bold text-white mt-1">{value}</p>
          {sub && <p className="text-xs text-gray-500 mt-1">{sub}</p>}
        </div>
        <div className={cn('p-2.5 rounded-lg', color)}><Icon className="w-5 h-5" /></div>
      </div>
    </div>
  );
}

function OverviewTab({ days }: { days: number }) {
  const { data: dailyData } = useQuery({ queryKey: ['sms-daily-stats', days], queryFn: () => smsApi.getDailyStats(days), refetchInterval: 30_000 });
  const { data: providerData } = useQuery({ queryKey: ['sms-provider-stats'], queryFn: smsApi.getProviderStats, refetchInterval: 30_000 });

  const daily = dailyData?.stats || [];
  const providers = providerData?.stats || [];

  const totalSent = daily.reduce((sum: number, d: Record<string, unknown>) => sum + (d.status === 'sent' || d.status === 'delivered' ? Number(d.count) : 0), 0);
  const totalFailed = daily.reduce((sum: number, d: Record<string, unknown>) => sum + (d.status === 'failed' ? Number(d.count) : 0), 0);
  const totalCost = daily.reduce((sum: number, d: Record<string, unknown>) => sum + Number(d.total_cost || 0), 0);
  const deliveryRate = totalSent > 0 ? ((totalSent / (totalSent + totalFailed)) * 100).toFixed(1) : '0';

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-4 gap-4">
        <StatsCard label="Total Sent" value={totalSent.toLocaleString()} icon={TrendingUp} color="bg-blue-500/20 text-blue-400" />
        <StatsCard label="Failed" value={totalFailed.toLocaleString()} icon={Activity} color="bg-red-500/20 text-red-400" />
        <StatsCard label="Delivery Rate" value={`${deliveryRate}%`} icon={BarChart3} color="bg-green-500/20 text-green-400" />
        <StatsCard label="Total Cost" value={`$${totalCost.toFixed(2)}`} icon={DollarSign} color="bg-purple-500/20 text-purple-400" />
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Daily Breakdown */}
        <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-5">
          <h3 className="text-lg font-semibold text-white mb-4">Daily Breakdown</h3>
          <div className="space-y-2">
            {daily.length === 0 && <p className="text-gray-500 text-sm py-4 text-center">No data for this period</p>}
            {(() => {
              const grouped: Record<string, { sent: number; failed: number; cost: number }> = {};
              for (const r of daily as Record<string, unknown>[]) {
                const date = r.date as string;
                if (!grouped[date]) grouped[date] = { sent: 0, failed: 0, cost: 0 };
                if (r.status === 'sent' || r.status === 'delivered') grouped[date].sent += Number(r.count);
                else if (r.status === 'failed') grouped[date].failed += Number(r.count);
                grouped[date].cost += Number(r.total_cost || 0);
              }
              return Object.entries(grouped).slice(0, 10).map(([date, stats]) => (
                <div key={date} className="flex justify-between items-center py-2 border-b border-gray-700/50">
                  <span className="text-sm text-gray-300">{new Date(date).toLocaleDateString()}</span>
                  <div className="flex gap-4 text-sm">
                    <span className="text-green-400">{stats.sent} sent</span>
                    {stats.failed > 0 && <span className="text-red-400">{stats.failed} failed</span>}
                    <span className="text-gray-400">${stats.cost.toFixed(2)}</span>
                  </div>
                </div>
              ));
            })()}
          </div>
        </div>

        {/* Provider Summary */}
        <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-5">
          <h3 className="text-lg font-semibold text-white mb-4">Provider Summary (24h)</h3>
          <div className="space-y-2">
            {providers.length === 0 && <p className="text-gray-500 text-sm py-4 text-center">No provider data</p>}
            {providers.map((p: Record<string, unknown>, i: number) => (
              <div key={i} className="flex justify-between items-center py-2 border-b border-gray-700/50">
                <span className="text-sm text-white font-medium">{p.provider_used as string}</span>
                <div className="flex gap-4 text-sm">
                  <span className={cn(p.status === 'sent' || p.status === 'delivered' ? 'text-green-400' : 'text-red-400')}>{p.count as number} {p.status as string}</span>
                  <span className="text-gray-400">${Number(p.total_cost || 0).toFixed(2)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function ProvidersTab({ days }: { days: number }) {
  const { data } = useQuery({ queryKey: ['sms-provider-comparison', days], queryFn: () => smsApi.getProviderComparison(days), refetchInterval: 30_000 });
  const providers = data?.stats || [];

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-white">Provider Performance Comparison</h3>
      <div className="bg-gray-800/50 border border-gray-700 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-800"><tr><th className="px-4 py-3 text-left text-gray-400">Provider</th><th className="px-4 py-3 text-right text-gray-400">Sent</th><th className="px-4 py-3 text-right text-gray-400">Delivered</th><th className="px-4 py-3 text-right text-gray-400">Failed</th><th className="px-4 py-3 text-right text-gray-400">Delivery Rate</th><th className="px-4 py-3 text-right text-gray-400">Cost/Msg</th><th className="px-4 py-3 text-right text-gray-400">Total Cost</th></tr></thead>
          <tbody className="divide-y divide-gray-700">
            {providers.map((p: Record<string, unknown>) => (
              <tr key={p.provider as string} className="hover:bg-gray-800/30">
                <td className="px-4 py-3 text-white font-medium">{p.provider as string}</td>
                <td className="px-4 py-3 text-right text-gray-300">{(p.total_sent as number)?.toLocaleString()}</td>
                <td className="px-4 py-3 text-right text-green-400">{(p.total_delivered as number)?.toLocaleString()}</td>
                <td className="px-4 py-3 text-right text-red-400">{(p.total_failed as number)?.toLocaleString()}</td>
                <td className="px-4 py-3 text-right">
                  <span className={cn('px-2 py-1 rounded text-xs', Number(p.delivery_rate) > 90 ? 'bg-green-500/20 text-green-400' : Number(p.delivery_rate) > 70 ? 'bg-yellow-500/20 text-yellow-400' : 'bg-red-500/20 text-red-400')}>{String(p.delivery_rate)}%</span>
                </td>
                <td className="px-4 py-3 text-right text-gray-300">${Number(p.cost_per_msg || 0).toFixed(4)}</td>
                <td className="px-4 py-3 text-right text-gray-300">${Number(p.total_cost || 0).toFixed(2)}</td>
              </tr>
            ))}
            {providers.length === 0 && <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-500">No provider analytics data</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function RegionsTab({ days }: { days: number }) {
  const { data } = useQuery({ queryKey: ['sms-regional-stats', days], queryFn: () => smsApi.getRegionalStats(days), refetchInterval: 30_000 });
  const regions = data?.stats || [];

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-white">Regional Delivery Stats</h3>
      <div className="bg-gray-800/50 border border-gray-700 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-800"><tr><th className="px-4 py-3 text-left text-gray-400">Region</th><th className="px-4 py-3 text-right text-gray-400">Sent</th><th className="px-4 py-3 text-right text-gray-400">Delivered</th><th className="px-4 py-3 text-right text-gray-400">Failed</th><th className="px-4 py-3 text-right text-gray-400">Delivery Rate</th></tr></thead>
          <tbody className="divide-y divide-gray-700">
            {regions.map((r: Record<string, unknown>) => (
              <tr key={r.region as string} className="hover:bg-gray-800/30">
                <td className="px-4 py-3 text-white font-medium">{r.region as string}</td>
                <td className="px-4 py-3 text-right text-gray-300">{(r.total_sent as number)?.toLocaleString()}</td>
                <td className="px-4 py-3 text-right text-green-400">{(r.total_delivered as number)?.toLocaleString()}</td>
                <td className="px-4 py-3 text-right text-red-400">{(r.total_failed as number)?.toLocaleString()}</td>
                <td className="px-4 py-3 text-right">
                  <span className={cn('px-2 py-1 rounded text-xs', Number(r.delivery_rate) > 90 ? 'bg-green-500/20 text-green-400' : Number(r.delivery_rate) > 70 ? 'bg-yellow-500/20 text-yellow-400' : 'bg-red-500/20 text-red-400')}>{String(r.delivery_rate)}%</span>
                </td>
              </tr>
            ))}
            {regions.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-500">No regional data available</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CostTab({ days }: { days: number }) {
  const { data } = useQuery({ queryKey: ['sms-cost-overview', days], queryFn: () => smsApi.getCostOverview(days), refetchInterval: 30_000 });
  const costs = data?.stats || [];
  const totalCost = costs.reduce((sum: number, c: Record<string, unknown>) => sum + Number(c.daily_cost || 0), 0);
  const totalSent = costs.reduce((sum: number, c: Record<string, unknown>) => sum + Number(c.daily_sent || 0), 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-4">
        <StatsCard label="Total Spend" value={`$${totalCost.toFixed(2)}`} icon={DollarSign} color="bg-purple-500/20 text-purple-400" />
        <StatsCard label="Total Messages" value={totalSent.toLocaleString()} icon={TrendingUp} color="bg-blue-500/20 text-blue-400" />
        <StatsCard label="Avg Cost/Msg" value={`$${totalSent > 0 ? (totalCost / totalSent).toFixed(4) : '0.0000'}`} icon={BarChart3} color="bg-green-500/20 text-green-400" />
      </div>

      <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-5">
        <h3 className="text-lg font-semibold text-white mb-4">Daily Cost Breakdown</h3>
        <div className="space-y-2">
          {costs.map((c: Record<string, unknown>) => {
            const pct = totalCost > 0 ? (Number(c.daily_cost) / totalCost) * 100 : 0;
            return (
              <div key={c.date as string} className="group">
                <div className="flex justify-between items-center py-2">
                  <span className="text-sm text-gray-300">{new Date(c.date as string).toLocaleDateString()}</span>
                  <div className="flex gap-4 text-sm">
                    <span className="text-gray-400">{Number(c.daily_sent).toLocaleString()} msgs</span>
                    <span className="text-white font-medium">${Number(c.daily_cost).toFixed(2)}</span>
                  </div>
                </div>
                <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
                  <div className="h-full bg-purple-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
          {costs.length === 0 && <p className="text-gray-500 text-sm py-4 text-center">No cost data available</p>}
        </div>
      </div>
    </div>
  );
}
