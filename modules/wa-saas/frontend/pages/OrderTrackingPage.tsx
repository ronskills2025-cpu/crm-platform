import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Package, Plus, Truck, Clock, CheckCircle, XCircle, Search } from 'lucide-react';
import toast from 'react-hot-toast';
import { waSaasApi } from '../../../../packages/ui/src/services/api';

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  confirmed: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  shipped: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  delivered: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  cancelled: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

export default function OrderTrackingPage() {
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState({ customer_name: '', customer_phone: '', order_number: '', items: '', total_amount: '' });

  const { data, isLoading } = useQuery({ queryKey: ['wa-saas-orders'], queryFn: () => waSaasApi.orders.list() });

  const createMut = useMutation({
    mutationFn: (d: Record<string, unknown>) => waSaasApi.orders.create(d),
    onSuccess: () => { toast.success('Order created'); qc.invalidateQueries({ queryKey: ['wa-saas-orders'] }); setShowCreate(false); resetForm(); },
    onError: () => toast.error('Failed to create order'),
  });

  const updateStatusMut = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => waSaasApi.orders.update(id, { status }),
    onSuccess: () => { toast.success('Status updated'); qc.invalidateQueries({ queryKey: ['wa-saas-orders'] }); },
    onError: () => toast.error('Failed to update'),
  });

  const resetForm = useCallback(() => setForm({ customer_name: '', customer_phone: '', order_number: '', items: '', total_amount: '' }), []);

  const orders = (data?.orders || []).filter((o: any) =>
    !search || o.order_number?.toLowerCase().includes(search.toLowerCase()) || o.customer_name?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2"><Package className="w-6 h-6 text-purple-600" /> Order Tracking</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Track and manage orders with WhatsApp notifications</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700">
          <Plus className="w-4 h-4" /> New Order
        </button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search orders..."
          className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100" />
      </div>

      {isLoading ? (
        <div className="space-y-3">{[...Array(4)].map((_, i) => <div key={i} className="h-20 rounded-xl bg-gray-200 dark:bg-gray-800 animate-pulse" />)}</div>
      ) : orders.length === 0 ? (
        <div className="text-center py-16 text-gray-500 dark:text-gray-400">
          <Truck className="w-12 h-12 mx-auto mb-3 opacity-40" />
          <p>No orders found</p>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map((o: any, idx: number) => (
            <motion.div key={o.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.03 }}
              className="p-4 rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 flex items-center gap-4">
              <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900/30">
                <Package className="w-5 h-5 text-purple-600" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-gray-900 dark:text-gray-100">#{o.order_number}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColors[o.status] || statusColors.pending}`}>{o.status}</span>
                </div>
                <div className="text-sm text-gray-500 mt-0.5">{o.customer_name} · {o.customer_phone}</div>
              </div>
              <div className="text-right mr-4">
                <span className="font-bold text-gray-900 dark:text-gray-100">₹{Number(o.total_amount || 0).toLocaleString()}</span>
              </div>
              <select value={o.status} onChange={e => updateStatusMut.mutate({ id: o.id, status: e.target.value })}
                className="text-xs px-2 py-1 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300">
                {['pending', 'confirmed', 'shipped', 'delivered', 'cancelled'].map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </motion.div>
          ))}
        </div>
      )}

      {showCreate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowCreate(false)}>
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} onClick={e => e.stopPropagation()}
            className="bg-white dark:bg-gray-900 rounded-2xl p-6 w-full max-w-md space-y-4">
            <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">New Order</h3>
            {([['Customer Name', 'customer_name'], ['Phone', 'customer_phone'], ['Order Number', 'order_number'], ['Items (comma-separated)', 'items'], ['Total Amount', 'total_amount']] as const).map(([label, key]) => (
              <div key={key}>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{label}</label>
                <input value={(form as any)[key]} onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100" />
              </div>
            ))}
            <div className="flex gap-3">
              <button onClick={() => setShowCreate(false)} className="flex-1 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-600 dark:text-gray-400">Cancel</button>
              <button onClick={() => createMut.mutate({ ...form, total_amount: Number(form.total_amount) || 0, items: form.items.split(',').map(s => s.trim()).filter(Boolean) })}
                disabled={createMut.isPending}
                className="flex-1 py-2 bg-brand-600 text-white rounded-lg font-semibold hover:bg-brand-700 disabled:opacity-50">
                {createMut.isPending ? 'Creating...' : 'Create'}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
