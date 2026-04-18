import { useEffect, useState } from 'react';
import { Crown, Users, Clock, AlertTriangle, DollarSign, TrendingUp, RefreshCcw, CheckCircle } from 'lucide-react';
import { membershipApi } from '../../../../packages/ui/src/services/api';

interface Membership {
  id: string; customer_name: string | null; customer_phone: string;
  tier: string; start_date: string; expiry_date: string;
  status: string; auto_renew: boolean; payment_status: string;
  amount: number; currency: string; renewal_count: number;
  created_at: string;
}
interface MembershipStats {
  total: number; active: number; expiring: number; expired: number;
  renewed: number; cancelled: number; revenue: number;
  avgAmount: number; renewalRate: number;
}

function statusBadge(s: string) {
  const m: Record<string, string> = {
    active: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
    expiring: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    expired: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    renewed: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    cancelled: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400',
  };
  return m[s] ?? m.active;
}

function tierBadge(t: string) {
  const m: Record<string, string> = {
    standard: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
    premium: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400',
    gold: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    platinum: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400',
  };
  return m[t] ?? m.standard;
}

export default function MembershipBotPage() {
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [stats, setStats] = useState<MembershipStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');

  async function load() {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (statusFilter !== 'all') params.status = statusFilter;
      const [sd, md] = await Promise.all([membershipApi.getStats(), membershipApi.list(params)]);
      setStats(sd.stats); setMemberships(md.memberships ?? []);
    } finally { setLoading(false); }
  }

  useEffect(() => { load(); }, [statusFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2"><Crown className="w-6 h-6 text-brand-600" /> Membership Renewal</h1>
      </div>

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Active', value: stats.active, icon: Users, color: 'text-emerald-500' },
            { label: 'Expiring', value: stats.expiring, icon: Clock, color: 'text-amber-500' },
            { label: 'Revenue', value: `₹${stats.revenue.toLocaleString()}`, icon: DollarSign, color: 'text-blue-500' },
            { label: 'Renewal Rate', value: `${stats.renewalRate}%`, icon: TrendingUp, color: 'text-violet-500' },
          ].map((c) => (
            <div key={c.label} className="rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-4">
              <div className="flex items-center gap-2 text-sm text-gray-500 mb-1"><c.icon className={`w-4 h-4 ${c.color}`} /> {c.label}</div>
              <p className="text-2xl font-bold">{c.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Status breakdown */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            { label: 'Active', value: stats.active, color: 'text-emerald-500' },
            { label: 'Expiring', value: stats.expiring, color: 'text-amber-500' },
            { label: 'Expired', value: stats.expired, color: 'text-red-500' },
            { label: 'Renewed', value: stats.renewed, color: 'text-blue-500' },
            { label: 'Cancelled', value: stats.cancelled, color: 'text-gray-500' },
          ].map((c) => (
            <div key={c.label} className="rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 px-3 py-2 text-center">
              <p className={`text-lg font-bold ${c.color}`}>{c.value}</p>
              <p className="text-xs text-gray-500">{c.label}</p>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        {['all', 'active', 'expiring', 'expired', 'renewed', 'cancelled'].map((s) => (
          <button key={s} onClick={() => setStatusFilter(s)}
            className={`px-3 py-1 text-xs rounded-full border transition-colors ${statusFilter === s ? 'bg-brand-600 text-white border-brand-600' : 'border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'}`}>
            {s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="animate-pulse space-y-3">{[...Array(5)].map((_, i) => <div key={i} className="h-12 rounded-lg bg-gray-200 dark:bg-gray-800" />)}</div>
      ) : memberships.length === 0 ? (
        <div className="text-center text-gray-500 py-12">No memberships yet. Add members to start tracking renewals.</div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-800">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-900">
              <tr>{['Customer', 'Phone', 'Tier', 'Amount', 'Expiry', 'Renewals', 'Auto', 'Status'].map((h) => (
                <th key={h} className="px-4 py-3 text-left font-medium text-gray-500">{h}</th>
              ))}</tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {memberships.map((m) => (
                <tr key={m.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                  <td className="px-4 py-3 font-medium">{m.customer_name ?? '—'}</td>
                  <td className="px-4 py-3 font-mono text-xs">{m.customer_phone}</td>
                  <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${tierBadge(m.tier)}`}>{m.tier}</span></td>
                  <td className="px-4 py-3 font-semibold">{m.currency} {Number(m.amount).toLocaleString()}</td>
                  <td className="px-4 py-3">{new Date(m.expiry_date).toLocaleDateString()}</td>
                  <td className="px-4 py-3 text-center">{m.renewal_count}</td>
                  <td className="px-4 py-3">{m.auto_renew ? <CheckCircle className="w-4 h-4 text-emerald-500" /> : <span className="text-gray-400">—</span>}</td>
                  <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusBadge(m.status)}`}>{m.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
