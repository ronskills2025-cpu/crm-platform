import { useEffect, useState } from 'react';
import { PhoneOff, Plus, Trash2, Settings, BarChart3 } from 'lucide-react';
import { growthApi } from '../../../../packages/ui/src/services/api';
import toast from 'react-hot-toast';

interface Config { id: string; name: string; phone_number: string; auto_reply_template: string; response_channel: string; response_delay_seconds: number; is_active: boolean; created_at: string; }
interface Call { id: string; caller_number: string; caller_name: string | null; status: string; auto_reply_sent: boolean; created_at: string; }
interface Stats { total_configs: number; total_calls: number; replied: number; pending: number; today: number; }

export default function MissedCallPage() {
  const [configs, setConfigs] = useState<Config[]>([]);
  const [calls, setCalls] = useState<Call[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'calls' | 'configs'>('calls');
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: '', phone_number: '', auto_reply_template: 'Hi! Sorry I missed your call. How can I help you?', response_channel: 'whatsapp', response_delay_seconds: 30 });

  async function load() {
    setLoading(true);
    try {
      const [c, cl, s] = await Promise.all([growthApi.missedCall.listConfigs(), growthApi.missedCall.listCalls(), growthApi.missedCall.getStats()]);
      setConfigs(c.configs ?? []); setCalls(cl.calls ?? []); setStats(s.stats);
    } finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  async function handleCreate() {
    try { await growthApi.missedCall.createConfig(form); toast.success('Config created'); setShowCreate(false); load(); } catch { toast.error('Failed'); }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete?')) return;
    try { await growthApi.missedCall.deleteConfig(id); toast.success('Deleted'); load(); } catch { toast.error('Failed'); }
  }

  const statusBadge = (s: string) => {
    const m: Record<string, string> = { pending: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400', replied: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400', converted: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' };
    return m[s] ?? m.pending;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2"><PhoneOff className="w-6 h-6 text-brand-600" /> Missed Call Automation</h1>
        <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 text-sm"><Plus className="w-4 h-4" /> New Config</button>
      </div>

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {[
            { label: 'Total Calls', value: stats.total_calls }, { label: 'Replied', value: stats.replied },
            { label: 'Pending', value: stats.pending }, { label: 'Today', value: stats.today }, { label: 'Configs', value: stats.total_configs },
          ].map(c => (
            <div key={c.label} className="rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-4">
              <p className="text-sm text-gray-500">{c.label}</p><p className="text-2xl font-bold">{c.value}</p>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-2 border-b border-gray-200 dark:border-gray-800">
        {(['calls', 'configs'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === t ? 'border-brand-600 text-brand-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            {t === 'calls' ? 'Missed Calls' : 'Configurations'}
          </button>
        ))}
      </div>

      {loading ? <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600" /></div>
      : tab === 'calls' ? (
        <div className="space-y-2">
          {calls.map(c => (
            <div key={c.id} className="rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-4 flex items-center justify-between">
              <div>
                <p className="font-medium">{c.caller_name ?? c.caller_number}</p>
                <p className="text-sm text-gray-500">{c.caller_number} · {new Date(c.created_at).toLocaleString()}</p>
              </div>
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusBadge(c.status)}`}>{c.status}</span>
            </div>
          ))}
          {!calls.length && <p className="text-center py-8 text-gray-500">No missed calls yet</p>}
        </div>
      ) : (
        <div className="space-y-3">
          {configs.map(c => (
            <div key={c.id} className="rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-4 flex items-center justify-between">
              <div>
                <p className="font-medium">{c.name}</p>
                <p className="text-sm text-gray-500">{c.phone_number} · via {c.response_channel} · {c.response_delay_seconds}s delay · {c.is_active ? '🟢' : '🔴'}</p>
              </div>
              <button onClick={() => handleDelete(c.id)} className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"><Trash2 className="w-4 h-4" /></button>
            </div>
          ))}
          {!configs.length && <p className="text-center py-8 text-gray-500">No configs yet</p>}
        </div>
      )}

      {showCreate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowCreate(false)}>
          <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 w-full max-w-md shadow-xl" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold mb-4">New Missed Call Config</h2>
            <div className="space-y-3">
              <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Config name" className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent" />
              <input value={form.phone_number} onChange={e => setForm({ ...form, phone_number: e.target.value })} placeholder="Phone number" className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent" />
              <textarea value={form.auto_reply_template} onChange={e => setForm({ ...form, auto_reply_template: e.target.value })} rows={3} className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent" />
              <select value={form.response_channel} onChange={e => setForm({ ...form, response_channel: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent">
                <option value="whatsapp">WhatsApp</option><option value="sms">SMS</option>
              </select>
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={() => setShowCreate(false)} className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm">Cancel</button>
              <button onClick={handleCreate} className="flex-1 px-4 py-2 bg-brand-600 text-white rounded-lg text-sm hover:bg-brand-700">Create</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
