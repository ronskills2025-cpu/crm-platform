import { useEffect, useState } from 'react';
import { LayoutDashboard, Package, Bell, Activity, ToggleLeft, ToggleRight, Trash2 } from 'lucide-react';
import { productDashboardApi } from '../../../../packages/ui/src/services/api';

interface Product { id: string; product_type: string; name: string; is_active: boolean; created_at: string; }
interface ProductEvent { id: string; product_type: string; event_type: string; entity_id: string | null; message: string | null; created_at: string; }
interface ProductNotification { id: string; product_type: string; notification_type: string; title: string; message: string; is_read: boolean; priority: string; created_at: string; }
interface DashboardStats { products: Product[]; funnel: Record<string, unknown>; appointment: Record<string, unknown>; payment: Record<string, unknown>; review: Record<string, unknown>; }

function typeBadge(t: string) {
  const m: Record<string, string> = {
    funnel: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    cart_recovery: 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400',
    appointment: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400',
    payment: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    review: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  };
  return m[t] ?? 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400';
}

export default function ProductDashboardPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [events, setEvents] = useState<ProductEvent[]>([]);
  const [notifications, setNotifications] = useState<ProductNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'overview' | 'events' | 'notifications'>('overview');

  async function load() {
    setLoading(true);
    try {
      const [pd, ed, nd] = await Promise.all([
        productDashboardApi.list(),
        productDashboardApi.listEvents({ limit: '50' }),
        productDashboardApi.listNotifications({ limit: '50' }),
      ]);
      setProducts(pd.products ?? []);
      setEvents(ed.events ?? []);
      setNotifications(nd.notifications ?? []);
    } finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleToggle(id: string) {
    await productDashboardApi.toggle(id);
    load();
  }

  async function handleMarkRead() {
    const unread = notifications.filter(n => !n.is_read).map(n => n.id);
    if (unread.length) { await productDashboardApi.markNotificationsRead(unread); load(); }
  }

  const unreadCount = notifications.filter(n => !n.is_read).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <LayoutDashboard className="w-6 h-6 text-brand-600" /> Automation Products
        </h1>
      </div>

      <div className="flex gap-2 border-b border-gray-200 dark:border-gray-800">
        {(['overview', 'events', 'notifications'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors relative ${tab === t ? 'border-brand-600 text-brand-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
            {t === 'notifications' && unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[10px] rounded-full flex items-center justify-center">{unreadCount}</span>
            )}
          </button>
        ))}
      </div>

      {loading && <div className="animate-pulse space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="h-20 rounded-lg bg-gray-200 dark:bg-gray-800" />)}</div>}

      {!loading && tab === 'overview' && (
        <div className="space-y-4">
          {products.length === 0 ? (
            <div className="text-center text-gray-500 py-12">
              <Package className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p>No automation products registered yet.</p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {products.map((p) => (
                <div key={p.id} className="rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${typeBadge(p.product_type)}`}>{p.product_type.replace('_', ' ')}</span>
                    <button onClick={() => handleToggle(p.id)} className="text-gray-400 hover:text-gray-600">
                      {p.is_active ? <ToggleRight className="w-5 h-5 text-emerald-500" /> : <ToggleLeft className="w-5 h-5" />}
                    </button>
                  </div>
                  <h3 className="font-semibold text-lg">{p.name}</h3>
                  <p className="text-xs text-gray-500 mt-1">Created {new Date(p.created_at).toLocaleDateString()}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {!loading && tab === 'events' && (
        <div className="space-y-2">
          {events.length === 0 ? (
            <div className="text-center text-gray-500 py-12">No events yet.</div>
          ) : events.map((e) => (
            <div key={e.id} className="flex items-start gap-3 rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-3">
              <Activity className="w-4 h-4 mt-0.5 text-gray-400 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${typeBadge(e.product_type)}`}>{e.product_type}</span>
                  <span className="text-sm font-medium">{e.event_type.replace(/_/g, ' ')}</span>
                </div>
                {e.message && <p className="text-sm text-gray-500 truncate">{e.message}</p>}
              </div>
              <span className="text-xs text-gray-400 flex-shrink-0">{new Date(e.created_at).toLocaleTimeString()}</span>
            </div>
          ))}
        </div>
      )}

      {!loading && tab === 'notifications' && (
        <div className="space-y-2">
          {unreadCount > 0 && (
            <button onClick={handleMarkRead} className="text-xs text-brand-600 hover:underline mb-2">Mark all as read</button>
          )}
          {notifications.length === 0 ? (
            <div className="text-center text-gray-500 py-12">No notifications.</div>
          ) : notifications.map((n) => (
            <div key={n.id} className={`flex items-start gap-3 rounded-lg border p-3 ${n.is_read ? 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800' : 'bg-blue-50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-900/30'}`}>
              <Bell className={`w-4 h-4 mt-0.5 flex-shrink-0 ${n.priority === 'high' ? 'text-red-500' : 'text-gray-400'}`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${typeBadge(n.product_type)}`}>{n.product_type}</span>
                  <span className="text-sm font-semibold">{n.title}</span>
                </div>
                <p className="text-sm text-gray-500">{n.message}</p>
              </div>
              <span className="text-xs text-gray-400 flex-shrink-0">{new Date(n.created_at).toLocaleTimeString()}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
