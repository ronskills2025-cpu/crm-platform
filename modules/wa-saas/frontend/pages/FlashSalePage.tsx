import { useEffect, useState } from 'react';
import { Zap, Plus, Trash2, Play, Pause, Users } from 'lucide-react';
import { waSaasApi } from '../../../../packages/ui/src/services/api';
import toast from 'react-hot-toast';

interface Sale { id: string; name: string; discount_type: string; discount_value: number; start_time: string; end_time: string; status: string; max_claims: number; created_at: string; }
interface Stats { total_sales: number; active_sales: number; total_recipients: number; total_claimed: number; }

export default function FlashSalePage() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: '', discount_type: 'percentage', discount_value: 10, message_template: 'Flash sale! {{discount}} off!', start_time: '', end_time: '', max_claims: 100 });

  async function load() {
    setLoading(true);
    try {
      const [s, st] = await Promise.all([waSaasApi.flashSales.list(), waSaasApi.flashSales.getStats()]);
      setSales(s.sales ?? []); setStats(st.stats);
    } finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  async function handleCreate() {
    try { await waSaasApi.flashSales.create(form); toast.success('Flash sale created'); setShowCreate(false); load(); } catch { toast.error('Failed'); }
  }

  async function handleAction(id: string, action: string) {
    try { await waSaasApi.flashSales.action(id, { action }); toast.success(`Sale ${action}d`); load(); } catch { toast.error('Failed'); }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete sale?')) return;
    try { await waSaasApi.flashSales.delete(id); toast.success('Deleted'); load(); } catch { toast.error('Failed'); }
  }

  const statusColor = (s: string) => s === 'active' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : s === 'draft' ? 'bg-gray-100 text-gray-600 dark:bg-gray-800' : s === 'paused' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30' : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2"><Zap className="w-6 h-6 text-brand-600" /> Flash Sales</h1>
        <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 text-sm"><Plus className="w-4 h-4" /> New Sale</button>
      </div>

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[{ label: 'Total Sales', value: stats.total_sales }, { label: 'Active', value: stats.active_sales }, { label: 'Recipients', value: stats.total_recipients }, { label: 'Claimed', value: stats.total_claimed }].map(c => (
            <div key={c.label} className="rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-4">
              <p className="text-sm text-gray-500">{c.label}</p><p className="text-2xl font-bold">{c.value}</p>
            </div>
          ))}
        </div>
      )}

      {loading ? <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600" /></div>
      : (
        <div className="space-y-3">
          {sales.map(s => (
            <div key={s.id} className="rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-4 flex items-center justify-between">
              <div>
                <p className="font-medium">{s.name}</p>
                <p className="text-sm text-gray-500">{s.discount_value}{s.discount_type === 'percentage' ? '%' : '$'} off · Max {s.max_claims} claims · {new Date(s.start_time).toLocaleDateString()} → {new Date(s.end_time).toLocaleDateString()}</p>
              </div>
              <div className="flex items-center gap-2">
                {s.status === 'draft' && <button onClick={() => handleAction(s.id, 'activate')} className="p-2 text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-lg"><Play className="w-4 h-4" /></button>}
                {s.status === 'active' && <button onClick={() => handleAction(s.id, 'pause')} className="p-2 text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded-lg"><Pause className="w-4 h-4" /></button>}
                <button onClick={() => handleDelete(s.id)} className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"><Trash2 className="w-4 h-4" /></button>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColor(s.status)}`}>{s.status}</span>
              </div>
            </div>
          ))}
          {!sales.length && <p className="text-center py-8 text-gray-500">No flash sales yet</p>}
        </div>
      )}

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowCreate(false)}>
          <div className="bg-white dark:bg-gray-900 rounded-xl p-6 w-full max-w-md space-y-4" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold">New Flash Sale</h2>
            <input className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent text-sm" placeholder="Sale name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
            <div className="grid grid-cols-2 gap-2">
              <select className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent text-sm" value={form.discount_type} onChange={e => setForm({ ...form, discount_type: e.target.value })}>
                <option value="percentage">Percentage</option><option value="fixed">Fixed</option>
              </select>
              <input className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent text-sm" type="number" placeholder="Value" value={form.discount_value} onChange={e => setForm({ ...form, discount_value: Number(e.target.value) })} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent text-sm" type="datetime-local" value={form.start_time} onChange={e => setForm({ ...form, start_time: e.target.value })} />
              <input className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent text-sm" type="datetime-local" value={form.end_time} onChange={e => setForm({ ...form, end_time: e.target.value })} />
            </div>
            <input className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent text-sm" type="number" placeholder="Max claims" value={form.max_claims} onChange={e => setForm({ ...form, max_claims: Number(e.target.value) })} />
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowCreate(false)} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700">Cancel</button>
              <button onClick={handleCreate} className="px-4 py-2 text-sm bg-brand-600 text-white rounded-lg hover:bg-brand-700">Create</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
