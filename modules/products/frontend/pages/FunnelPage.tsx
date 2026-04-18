import { useState } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { Target, TrendingUp, Users, Zap, Plus, Star, PhoneCall, MousePointerClick } from 'lucide-react';
import { funnelApi } from '../../../../packages/ui/src/services/api';
import { Pagination } from '../../../../packages/ui/src/components/ui/Pagination';
import toast from 'react-hot-toast';

const PAGE_SIZE = 50;

interface FunnelLead {
  id: string; name: string | null; phone: string; source: string | null;
  status: string; score: number; current_step: number; payment_amount: number | null;
  created_at: string;
}
interface FunnelStats {
  total: number; new: number; contacted: number; hot: number; converted: number; lost: number;
  conversionRate: number; totalPayment: number;
}
interface FunnelStep {
  id: string; step_order: number; step_type: string; message_template: string | null;
  delay_minutes: number;
}

function statusBadge(s: string) {
  const m: Record<string, string> = {
    new: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    contacted: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
    hot: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    converted: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
    lost: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400',
  };
  return m[s] ?? m.new;
}

export default function FunnelPage() {
  const [tab, setTab] = useState<'leads' | 'steps'>('leads');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(0);

  const { data, isLoading: loading } = useQuery({
    queryKey: ['funnel', statusFilter, page],
    queryFn: async () => {
      const params: Record<string, string | number> = { limit: PAGE_SIZE, offset: page * PAGE_SIZE };
      if (statusFilter !== 'all') params.status = statusFilter;
      const [ld, sd] = await Promise.all([funnelApi.listLeads(params), funnelApi.getStats()]);
      return {
        leads: (ld.leads ?? []) as FunnelLead[], total: ld.total ?? ld.leads?.length ?? 0,
        stats: (sd.stats ?? null) as FunnelStats | null,
      };
    },
    staleTime: 30_000,
    refetchInterval: 60_000,
    placeholderData: keepPreviousData,
  });
  const leads = data?.leads ?? [];
  const total = data?.total ?? 0;
  const stats = data?.stats ?? null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2"><Target className="w-6 h-6 text-brand-600" /> Funnel-in-a-Box</h1>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Total Leads', value: stats.total, icon: Users, color: 'text-blue-500' },
            { label: 'Hot Leads', value: stats.hot, icon: Zap, color: 'text-red-500' },
            { label: 'Converted', value: stats.converted, icon: TrendingUp, color: 'text-emerald-500' },
            { label: 'Conversion Rate', value: `${stats.conversionRate}%`, icon: Star, color: 'text-amber-500' },
          ].map((c) => (
            <div key={c.label} className="rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-4">
              <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
                <c.icon className={`w-4 h-4 ${c.color}`} /> {c.label}
              </div>
              <p className="text-2xl font-bold">{c.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-200 dark:border-gray-800">
        {(['leads', 'steps'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === t ? 'border-brand-600 text-brand-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            {t === 'leads' ? 'Leads' : 'Funnel Steps'}
          </button>
        ))}
      </div>

      {tab === 'leads' && (
        <>
          <div className="flex gap-2">
            {['all', 'new', 'contacted', 'hot', 'converted', 'lost'].map((s) => (
              <button key={s} onClick={() => { setStatusFilter(s); setPage(0); }}
                className={`px-3 py-1 text-xs rounded-full border transition-colors ${statusFilter === s ? 'bg-brand-600 text-white border-brand-600' : 'border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'}`}>
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="animate-pulse space-y-3">{[...Array(5)].map((_, i) => <div key={i} className="h-12 rounded-lg bg-gray-200 dark:bg-gray-800" />)}</div>
          ) : leads.length === 0 ? (
            <div className="text-center text-gray-500 py-12">No funnel leads yet. Connect a Meta Ads webhook to start capturing leads.</div>
          ) : (
            <>
              <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-800">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 dark:bg-gray-900">
                    <tr>{['Name', 'Phone', 'Source', 'Status', 'Score', 'Step', 'Created'].map((h) => (
                      <th key={h} className="px-4 py-3 text-left font-medium text-gray-500">{h}</th>
                    ))}</tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                    {leads.map((l) => (
                      <tr key={l.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                        <td className="px-4 py-3 font-medium">{l.name ?? '—'}</td>
                        <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{l.phone}</td>
                        <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{l.source ?? '—'}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusBadge(l.status)}`}>{l.status}</span>
                        </td>
                        <td className="px-4 py-3 font-mono">{l.score}</td>
                        <td className="px-4 py-3">Step {l.current_step}</td>
                        <td className="px-4 py-3 text-gray-500">{new Date(l.created_at).toLocaleDateString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pagination page={page} pageSize={PAGE_SIZE} total={total} onPageChange={setPage} />
            </>
          )}
        </>
      )}

      {tab === 'steps' && (
        <div className="rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-6 text-center text-gray-500">
          <Zap className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p className="text-lg font-medium mb-1">Funnel Step Editor</p>
          <p className="text-sm">Configure your multi-step WhatsApp automation flows here. Select a product to manage its steps.</p>
        </div>
      )}
    </div>
  );
}
