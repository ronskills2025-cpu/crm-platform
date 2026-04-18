import { useEffect, useState } from 'react';
import { CreditCard, AlertTriangle, CheckCircle, Clock, DollarSign, TrendingUp } from 'lucide-react';
import { paymentBotApi } from '../../../../packages/ui/src/services/api';

interface PaymentCollection {
  id: string; customer_name: string | null; customer_phone: string; description: string;
  amount_due: number; amount_paid: number; currency: string; status: string;
  due_date: string; reminder_count: number; recurring: boolean; created_at: string;
}
interface PaymentStats {
  total: number; pending: number; paid: number; overdue: number; escalated: number;
  collectionRate: number; totalDue: number; totalCollected: number;
}

function statusBadge(s: string) {
  const m: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
    partial: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    paid: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
    overdue: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    escalated: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  };
  return m[s] ?? m.pending;
}

function fmtMoney(amount: number, currency = 'USD') {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount / 100);
}

export default function PaymentBotPage() {
  const [collections, setCollections] = useState<PaymentCollection[]>([]);
  const [stats, setStats] = useState<PaymentStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');

  async function load() {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (statusFilter !== 'all') params.status = statusFilter;
      const [sd, cd] = await Promise.all([paymentBotApi.getStats(), paymentBotApi.list(params)]);
      setStats(sd.stats); setCollections(cd.collections ?? []);
    } finally { setLoading(false); }
  }

  useEffect(() => { load(); }, [statusFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2"><CreditCard className="w-6 h-6 text-brand-600" /> Payment Collection</h1>
      </div>

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Total Due', value: fmtMoney(stats.totalDue), icon: DollarSign, color: 'text-blue-500' },
            { label: 'Collected', value: fmtMoney(stats.totalCollected), icon: CheckCircle, color: 'text-emerald-500' },
            { label: 'Collection Rate', value: `${stats.collectionRate}%`, icon: TrendingUp, color: 'text-violet-500' },
            { label: 'Overdue', value: stats.overdue, icon: AlertTriangle, color: 'text-red-500' },
          ].map((c) => (
            <div key={c.label} className="rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-4">
              <div className="flex items-center gap-2 text-sm text-gray-500 mb-1"><c.icon className={`w-4 h-4 ${c.color}`} /> {c.label}</div>
              <p className="text-2xl font-bold">{c.value}</p>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        {['all', 'pending', 'partial', 'paid', 'overdue', 'escalated'].map((s) => (
          <button key={s} onClick={() => setStatusFilter(s)}
            className={`px-3 py-1 text-xs rounded-full border transition-colors ${statusFilter === s ? 'bg-brand-600 text-white border-brand-600' : 'border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'}`}>
            {s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="animate-pulse space-y-3">{[...Array(5)].map((_, i) => <div key={i} className="h-12 rounded-lg bg-gray-200 dark:bg-gray-800" />)}</div>
      ) : collections.length === 0 ? (
        <div className="text-center text-gray-500 py-12">No payment collections yet.</div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-800">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-900">
              <tr>{['Customer', 'Phone', 'Description', 'Due', 'Paid', 'Status', 'Due Date', 'Reminders'].map((h) => (
                <th key={h} className="px-4 py-3 text-left font-medium text-gray-500">{h}</th>
              ))}</tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
              {collections.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  <td className="px-4 py-3 font-medium">{c.customer_name ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{c.customer_phone}</td>
                  <td className="px-4 py-3">{c.description}</td>
                  <td className="px-4 py-3 font-mono">{fmtMoney(c.amount_due, c.currency)}</td>
                  <td className="px-4 py-3 font-mono">{fmtMoney(c.amount_paid, c.currency)}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusBadge(c.status)}`}>{c.status}</span>
                  </td>
                  <td className="px-4 py-3 text-gray-500">{new Date(c.due_date).toLocaleDateString()}</td>
                  <td className="px-4 py-3 text-center">{c.reminder_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
