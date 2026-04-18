import { useEffect, useState } from 'react';
import { ShoppingCart, TrendingUp, CheckCircle, Clock, RefreshCw } from 'lucide-react';
import { cartApi } from '../../../../packages/ui/src/services/api';

interface CartSession {
  id: string;
  cartToken: string;
  customerPhone: string;
  customerName: string | null;
  cartValue: number;
  currency: string;
  status: string;
  checkoutUrl: string;
  firstMessageSentAt: string | null;
  followupSentAt: string | null;
  recoveredAt: string | null;
  createdAt: string;
}

interface CartStats {
  total: number;
  abandoned: number;
  recovered: number;
  expired: number;
  recoveryRate: string;
  totalRevenue: number;
  currency: string;
}

interface Conversion {
  id: string;
  orderId: string | null;
  orderValue: number;
  channel: string;
  createdAt: string;
}

interface ConversionStats {
  count: number;
  totalRevenue: number;
  avgOrderValue: number;
}

function statusColour(status: string) {
  const map: Record<string, string> = {
    abandoned: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    recovered: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
    expired:   'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400',
  };
  return map[status] ?? map.expired;
}

function fmtMoney(amount: number, currency = 'USD') {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount / 100);
}

export default function CartRecoveryPage() {
  const [sessions, setSessions] = useState<CartSession[]>([]);
  const [stats, setStats] = useState<CartStats | null>(null);
  const [conversions, setConversions] = useState<Conversion[]>([]);
  const [convStats, setConvStats] = useState<ConversionStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'carts' | 'conversions'>('carts');
  const [statusFilter, setStatusFilter] = useState('all');
  const [recovering, setRecovering] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (statusFilter !== 'all') params.status = statusFilter;

      const [sd, sessD, convD, convSd] = await Promise.all([
        cartApi.getStats(),
        cartApi.listSessions(params),
        cartApi.listConversions(),
        cartApi.getConversionStats(),
      ]);
      setStats(sd.stats);
      setSessions(sessD.sessions ?? []);
      setConversions(convD.conversions ?? []);
      setConvStats(convSd.stats);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [statusFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleRecover(cartToken: string) {
    setRecovering(cartToken);
    try {
      await cartApi.markRecovered(cartToken);
      load();
    } finally {
      setRecovering(null);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Cart Recovery</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Shopify abandoned cart recovery via WhatsApp</p>
      </div>

      {/* Stats row */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {[
            { label: 'Total Carts', value: stats.total, icon: ShoppingCart, colour: 'text-gray-600 dark:text-gray-400' },
            { label: 'Abandoned', value: stats.abandoned, icon: Clock, colour: 'text-amber-600 dark:text-amber-400' },
            { label: 'Recovered', value: stats.recovered, icon: CheckCircle, colour: 'text-emerald-600 dark:text-emerald-400' },
            { label: 'Recovery Rate', value: `${stats.recoveryRate}%`, icon: TrendingUp, colour: 'text-blue-600 dark:text-blue-400' },
            {
              label: 'Revenue Recovered',
              value: fmtMoney(stats.totalRevenue, stats.currency),
              icon: TrendingUp,
              colour: 'text-purple-600 dark:text-purple-400',
            },
          ].map(({ label, value, icon: Icon, colour }) => (
            <div key={label} className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4">
              <div className="flex items-center gap-2 mb-1">
                <Icon className={`w-4 h-4 ${colour}`} />
                <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
              </div>
              <p className={`text-xl font-bold ${colour}`}>{value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200 dark:border-gray-800">
        {(['carts', 'conversions'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium capitalize transition-colors border-b-2 -mb-px ${
              tab === t
                ? 'border-brand-500 text-brand-600 dark:text-brand-400'
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'carts' && (
        <>
          {/* Filter */}
          <div className="flex gap-2">
            {['all', 'abandoned', 'recovered', 'expired'].map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-1 text-xs rounded-full font-medium transition-colors capitalize ${
                  statusFilter === s
                    ? 'bg-brand-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                }`}
              >
                {s}
              </button>
            ))}
          </div>

          <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-hidden">
            {loading ? (
              <div className="p-8 text-center text-sm text-gray-400">Loading…</div>
            ) : sessions.length === 0 ? (
              <div className="p-8 text-center text-sm text-gray-400">No cart sessions found.</div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-800">
                    {['Customer', 'Cart Value', 'Status', '1st Msg', 'Follow-up', 'Recovered', ''].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {sessions.map((s) => (
                    <tr key={s.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900 dark:text-gray-100">{s.customerName ?? '—'}</div>
                        <div className="text-xs text-gray-400">{s.customerPhone}</div>
                      </td>
                      <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">
                        {fmtMoney(s.cartValue, s.currency)}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-0.5 rounded-md text-xs font-medium capitalize ${statusColour(s.status)}`}>
                          {s.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400">
                        {s.firstMessageSentAt ? new Date(s.firstMessageSentAt).toLocaleString() : '—'}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400">
                        {s.followupSentAt ? new Date(s.followupSentAt).toLocaleString() : '—'}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400">
                        {s.recoveredAt ? new Date(s.recoveredAt).toLocaleString() : '—'}
                      </td>
                      <td className="px-4 py-3">
                        {s.status === 'abandoned' && (
                          <button
                            onClick={() => handleRecover(s.cartToken)}
                            disabled={recovering === s.cartToken}
                            className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-lg bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 disabled:opacity-50 transition-colors"
                          >
                            <RefreshCw className={`w-3 h-3 ${recovering === s.cartToken ? 'animate-spin' : ''}`} />
                            Mark Recovered
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      {tab === 'conversions' && (
        <>
          {convStats && (
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'Total Conversions', value: convStats.count },
                { label: 'Total Revenue', value: fmtMoney(convStats.totalRevenue) },
                { label: 'Avg Order Value', value: fmtMoney(convStats.avgOrderValue) },
              ].map(({ label, value }) => (
                <div key={label} className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4">
                  <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
                  <p className="text-xl font-bold text-gray-900 dark:text-gray-100 mt-1">{value}</p>
                </div>
              ))}
            </div>
          )}

          <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-hidden">
            {conversions.length === 0 ? (
              <div className="p-8 text-center text-sm text-gray-400">No conversions tracked yet.</div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-800">
                    {['Order ID', 'Channel', 'Order Value', 'Date'].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {conversions.map((c) => (
                    <tr key={c.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                      <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">{c.orderId ?? '—'}</td>
                      <td className="px-4 py-3 text-gray-500 dark:text-gray-400 capitalize">{c.channel}</td>
                      <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">{fmtMoney(c.orderValue)}</td>
                      <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{new Date(c.createdAt).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  );
}
