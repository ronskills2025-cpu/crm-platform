import { useEffect, useState } from 'react';
import { Users, Plus, Trash2, Play, Pause } from 'lucide-react';
import { waSaasApi } from '../../../../packages/ui/src/services/api';
import toast from 'react-hot-toast';

interface Campaign { id: string; name: string; inactivity_days: number; message_template: string; status: string; max_retries: number; created_at: string; }
interface Stats { total_campaigns: number; active_campaigns: number; total_contacts: number; total_reengaged: number; }

export default function ReengagementPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: '', inactivity_days: 30, message_template: 'Hey {{name}}, we miss you! Here\'s a special offer...', max_retries: 2 });

  async function load() {
    setLoading(true);
    try {
      const [c, s] = await Promise.all([waSaasApi.reengagement.list(), waSaasApi.reengagement.getStats()]);
      setCampaigns(c.campaigns ?? []); setStats(s.stats);
    } finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  async function handleCreate() {
    try { await waSaasApi.reengagement.create(form); toast.success('Campaign created'); setShowCreate(false); load(); } catch { toast.error('Failed'); }
  }

  async function handleAction(id: string, action: string) {
    try { await waSaasApi.reengagement.action(id, { action }); toast.success(`${action}d`); load(); } catch { toast.error('Failed'); }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete campaign?')) return;
    try { await waSaasApi.reengagement.delete(id); toast.success('Deleted'); load(); } catch { toast.error('Failed'); }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2"><Users className="w-6 h-6 text-brand-600" /> Re-Engagement</h1>
        <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 text-sm"><Plus className="w-4 h-4" /> New Campaign</button>
      </div>

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[{ label: 'Campaigns', value: stats.total_campaigns }, { label: 'Active', value: stats.active_campaigns }, { label: 'Contacts', value: stats.total_contacts }, { label: 'Re-engaged', value: stats.total_reengaged }].map(c => (
            <div key={c.label} className="rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-4">
              <p className="text-sm text-gray-500">{c.label}</p><p className="text-2xl font-bold">{c.value}</p>
            </div>
          ))}
        </div>
      )}

      {loading ? <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600" /></div>
      : (
        <div className="space-y-3">
          {campaigns.map(c => (
            <div key={c.id} className="rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-4 flex items-center justify-between">
              <div>
                <p className="font-medium">{c.name}</p>
                <p className="text-sm text-gray-500">Inactive {c.inactivity_days} days · Max {c.max_retries} retries</p>
              </div>
              <div className="flex items-center gap-2">
                {c.status === 'draft' && <button onClick={() => handleAction(c.id, 'activate')} className="p-2 text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-lg"><Play className="w-4 h-4" /></button>}
                {c.status === 'active' && <button onClick={() => handleAction(c.id, 'pause')} className="p-2 text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded-lg"><Pause className="w-4 h-4" /></button>}
                <button onClick={() => handleDelete(c.id)} className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"><Trash2 className="w-4 h-4" /></button>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${c.status === 'active' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : c.status === 'paused' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30' : 'bg-gray-100 text-gray-500 dark:bg-gray-800'}`}>{c.status}</span>
              </div>
            </div>
          ))}
          {!campaigns.length && <p className="text-center py-8 text-gray-500">No campaigns yet</p>}
        </div>
      )}

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowCreate(false)}>
          <div className="bg-white dark:bg-gray-900 rounded-xl p-6 w-full max-w-md space-y-4" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold">New Re-Engagement Campaign</h2>
            <input className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent text-sm" placeholder="Campaign name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
            <input className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent text-sm" type="number" placeholder="Inactivity days" value={form.inactivity_days} onChange={e => setForm({ ...form, inactivity_days: Number(e.target.value) })} />
            <textarea className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent text-sm" placeholder="Message template" rows={3} value={form.message_template} onChange={e => setForm({ ...form, message_template: e.target.value })} />
            <input className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent text-sm" type="number" placeholder="Max retries" value={form.max_retries} onChange={e => setForm({ ...form, max_retries: Number(e.target.value) })} />
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
