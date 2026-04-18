import { useEffect, useState } from 'react';
import { Radio, Plus, Trash2 } from 'lucide-react';
import { waSaasApi } from '../../../../packages/ui/src/services/api';
import toast from 'react-hot-toast';

interface Config { id: string; name: string; timezone: string; optimal_hours: unknown; throttle_per_second: number; is_active: boolean; created_at: string; }
interface Batch { id: string; config_id: string; scheduled_at: string; status: string; sent_count: number; failed_count: number; }
interface Stats { total_configs: number; active_configs: number; total_batches: number; total_sent: number; }

export default function BroadcastOptimizerPage() {
  const [configs, setConfigs] = useState<Config[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'configs' | 'batches'>('configs');
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: '', timezone: 'UTC', optimal_hours: { start: 9, end: 18 }, throttle_per_second: 10 });

  async function load() {
    setLoading(true);
    try {
      const [c, b, s] = await Promise.all([waSaasApi.broadcastOpt.listConfigs(), waSaasApi.broadcastOpt.listBatches(), waSaasApi.broadcastOpt.getStats()]);
      setConfigs(c.configs ?? []); setBatches(b.batches ?? []); setStats(s.stats);
    } finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  async function handleCreate() {
    try { await waSaasApi.broadcastOpt.createConfig(form); toast.success('Config created'); setShowCreate(false); load(); } catch { toast.error('Failed'); }
  }

  async function handleDeleteConfig(id: string) {
    if (!confirm('Delete config?')) return;
    try { await waSaasApi.broadcastOpt.deleteConfig(id); toast.success('Deleted'); load(); } catch { toast.error('Failed'); }
  }

  async function handleDeleteBatch(id: string) {
    if (!confirm('Delete batch?')) return;
    try { await waSaasApi.broadcastOpt.deleteBatch(id); toast.success('Deleted'); load(); } catch { toast.error('Failed'); }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2"><Radio className="w-6 h-6 text-brand-600" /> Broadcast Optimizer</h1>
        <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 text-sm"><Plus className="w-4 h-4" /> New Config</button>
      </div>

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[{ label: 'Configs', value: stats.total_configs }, { label: 'Active', value: stats.active_configs }, { label: 'Batches', value: stats.total_batches }, { label: 'Sent', value: stats.total_sent }].map(c => (
            <div key={c.label} className="rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-4">
              <p className="text-sm text-gray-500">{c.label}</p><p className="text-2xl font-bold">{c.value}</p>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-2 border-b border-gray-200 dark:border-gray-800">
        {(['configs', 'batches'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === t ? 'border-brand-600 text-brand-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>{t === 'configs' ? 'Configs' : 'Batches'}</button>
        ))}
      </div>

      {loading ? <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600" /></div>
      : tab === 'configs' ? (
        <div className="space-y-3">
          {configs.map(c => (
            <div key={c.id} className="rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-4 flex items-center justify-between">
              <div>
                <p className="font-medium">{c.name}</p>
                <p className="text-sm text-gray-500">TZ: {c.timezone} · Throttle: {c.throttle_per_second}/s</p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => handleDeleteConfig(c.id)} className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"><Trash2 className="w-4 h-4" /></button>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${c.is_active ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-gray-100 text-gray-500 dark:bg-gray-800'}`}>{c.is_active ? 'Active' : 'Inactive'}</span>
              </div>
            </div>
          ))}
          {!configs.length && <p className="text-center py-8 text-gray-500">No configs yet</p>}
        </div>
      ) : (
        <div className="space-y-2">
          {batches.map(b => (
            <div key={b.id} className="rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Batch {b.id.slice(0, 8)}</p>
                <p className="text-xs text-gray-500">Scheduled: {new Date(b.scheduled_at).toLocaleString()} · Sent: {b.sent_count} · Failed: {b.failed_count}</p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => handleDeleteBatch(b.id)} className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"><Trash2 className="w-4 h-4" /></button>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${b.status === 'sent' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : b.status === 'sending' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30' : b.status === 'failed' ? 'bg-red-100 text-red-700 dark:bg-red-900/30' : 'bg-gray-100 text-gray-500 dark:bg-gray-800'}`}>{b.status}</span>
              </div>
            </div>
          ))}
          {!batches.length && <p className="text-center py-8 text-gray-500">No batches yet</p>}
        </div>
      )}

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowCreate(false)}>
          <div className="bg-white dark:bg-gray-900 rounded-xl p-6 w-full max-w-md space-y-4" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold">New Broadcast Config</h2>
            <input className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent text-sm" placeholder="Config name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
            <input className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent text-sm" placeholder="Timezone" value={form.timezone} onChange={e => setForm({ ...form, timezone: e.target.value })} />
            <input className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent text-sm" type="number" placeholder="Throttle/sec" value={form.throttle_per_second} onChange={e => setForm({ ...form, throttle_per_second: Number(e.target.value) })} />
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
