import { useEffect, useState } from 'react';
import { ShoppingBag, Package, DollarSign, Truck, AlertTriangle, TrendingUp, BarChart3, CheckCircle } from 'lucide-react';
import { catalogApi } from '../../../../packages/ui/src/services/api';

interface CatalogOrder {
  id: string; customer_name: string | null; customer_phone: string;
  status: string; total_amount: number; currency: string;
  payment_link: string | null; payment_status: string;
  created_at: string;
}
interface CatalogStats {
  totalProducts: number; activeProducts: number; totalOrders: number;
  pending: number; paid: number; shipped: number; delivered: number;
  cancelled: number; revenue: number; lowStock: number;
}

function statusBadge(s: string) {
  const m: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
    confirmed: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    paid: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
    shipped: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400',
    delivered: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400',
    cancelled: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  };
  return m[s] ?? m.pending;
}

export default function CatalogBotPage() {
  const [orders, setOrders] = useState<CatalogOrder[]>([]);
  const [stats, setStats] = useState<CatalogStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');

  async function load() {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (statusFilter !== 'all') params.status = statusFilter;
      const [sd, od] = await Promise.all([catalogApi.getStats(), catalogApi.listOrders(params)]);
      setStats(sd.stats); setOrders(od.orders ?? []);
    } finally { setLoading(false); }
  }

  useEffect(() => { load(); }, [statusFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2"><ShoppingBag className="w-6 h-6 text-brand-600" /> Catalog &amp; Orders</h1>
      </div>

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Products', value: `${stats.activeProducts}/${stats.totalProducts}`, icon: Package, color: 'text-blue-500' },
            { label: 'Total Orders', value: stats.totalOrders, icon: ShoppingBag, color: 'text-violet-500' },
            { label: 'Revenue', value: `₹${stats.revenue.toLocaleString()}`, icon: DollarSign, color: 'text-emerald-500' },
            { label: 'Low Stock', value: stats.lowStock, icon: AlertTriangle, color: 'text-amber-500' },
          ].map((c) => (
            <div key={c.label} className="rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-4">
              <div className="flex items-center gap-2 text-sm text-gray-500 mb-1"><c.icon className={`w-4 h-4 ${c.color}`} /> {c.label}</div>
              <p className="text-2xl font-bold">{c.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Order breakdown */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            { label: 'Pending', value: stats.pending, color: 'text-yellow-500' },
            { label: 'Paid', value: stats.paid, color: 'text-emerald-500' },
            { label: 'Shipped', value: stats.shipped, color: 'text-violet-500' },
            { label: 'Delivered', value: stats.delivered, color: 'text-teal-500' },
            { label: 'Cancelled', value: stats.cancelled, color: 'text-red-500' },
          ].map((c) => (
            <div key={c.label} className="rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 px-3 py-2 text-center">
              <p className={`text-lg font-bold ${c.color}`}>{c.value}</p>
              <p className="text-xs text-gray-500">{c.label}</p>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        {['all', 'pending', 'confirmed', 'paid', 'shipped', 'delivered', 'cancelled'].map((s) => (
          <button key={s} onClick={() => setStatusFilter(s)}
            className={`px-3 py-1 text-xs rounded-full border transition-colors ${statusFilter === s ? 'bg-brand-600 text-white border-brand-600' : 'border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'}`}>
            {s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="animate-pulse space-y-3">{[...Array(5)].map((_, i) => <div key={i} className="h-12 rounded-lg bg-gray-200 dark:bg-gray-800" />)}</div>
      ) : orders.length === 0 ? (
        <div className="text-center text-gray-500 py-12">No orders yet. Add catalog products to start receiving orders.</div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-800">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-900">
              <tr>{['Customer', 'Phone', 'Amount', 'Payment', 'Status', 'Date'].map((h) => (
                <th key={h} className="px-4 py-3 text-left font-medium text-gray-500">{h}</th>
              ))}</tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {orders.map((o) => (
                <tr key={o.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                  <td className="px-4 py-3 font-medium">{o.customer_name ?? '—'}</td>
                  <td className="px-4 py-3 font-mono text-xs">{o.customer_phone}</td>
                  <td className="px-4 py-3 font-semibold">{o.currency} {Number(o.total_amount).toLocaleString()}</td>
                  <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusBadge(o.payment_status === 'paid' ? 'paid' : 'pending')}`}>{o.payment_status}</span></td>
                  <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusBadge(o.status)}`}>{o.status}</span></td>
                  <td className="px-4 py-3 text-gray-500">{new Date(o.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
