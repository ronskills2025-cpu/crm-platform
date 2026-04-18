import { useEffect, useState } from 'react';
import { Link2, Plus, Trash2, BarChart3, ExternalLink, Copy } from 'lucide-react';
import { waSaasApi } from '../../../../packages/ui/src/services/api';
import toast from 'react-hot-toast';

interface TrackedLink { id: string; short_code: string; original_url: string; label: string; click_count: number; conversion_count: number; is_active: boolean; created_at: string; }
interface Stats { total_links: number; active_links: number; total_clicks: number; total_conversions: number; }

export default function LinkTrackingPage() {
  const [links, setLinks] = useState<TrackedLink[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ original_url: '', label: '', utm_source: '', utm_medium: '', utm_campaign: '' });

  async function load() {
    setLoading(true);
    try {
      const [l, s] = await Promise.all([waSaasApi.links.list(), waSaasApi.links.getStats()]);
      setLinks(l.links ?? []); setStats(s.stats);
    } finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  async function handleCreate() {
    try { await waSaasApi.links.create(form); toast.success('Link created'); setShowCreate(false); load(); } catch { toast.error('Failed'); }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete link?')) return;
    try { await waSaasApi.links.delete(id); toast.success('Deleted'); load(); } catch { toast.error('Failed'); }
  }

  function copyLink(code: string) {
    navigator.clipboard.writeText(`${window.location.origin}/api/wa-saas/l/${code}`);
    toast.success('Link copied!');
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2"><Link2 className="w-6 h-6 text-brand-600" /> Link Tracking</h1>
        <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 text-sm"><Plus className="w-4 h-4" /> New Link</button>
      </div>

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[{ label: 'Links', value: stats.total_links }, { label: 'Active', value: stats.active_links }, { label: 'Clicks', value: stats.total_clicks }, { label: 'Conversions', value: stats.total_conversions }].map(c => (
            <div key={c.label} className="rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-4">
              <p className="text-sm text-gray-500">{c.label}</p><p className="text-2xl font-bold">{c.value}</p>
            </div>
          ))}
        </div>
      )}

      {loading ? <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600" /></div>
      : (
        <div className="space-y-3">
          {links.map(l => (
            <div key={l.id} className="rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">{l.label || l.short_code}</p>
                  <p className="text-sm text-gray-500 truncate max-w-md">{l.original_url}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => copyLink(l.short_code)} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"><Copy className="w-4 h-4" /></button>
                  <button onClick={() => handleDelete(l.id)} className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
              <div className="flex gap-4 mt-2 text-sm">
                <span className="text-blue-500"><BarChart3 className="w-3 h-3 inline mr-1" />{l.click_count} clicks</span>
                <span className="text-emerald-500"><ExternalLink className="w-3 h-3 inline mr-1" />{l.conversion_count} conversions</span>
                <span className="text-gray-400">Code: {l.short_code}</span>
              </div>
            </div>
          ))}
          {!links.length && <p className="text-center py-8 text-gray-500">No tracked links yet</p>}
        </div>
      )}

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowCreate(false)}>
          <div className="bg-white dark:bg-gray-900 rounded-xl p-6 w-full max-w-md space-y-4" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold">New Tracked Link</h2>
            <input className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent text-sm" placeholder="URL" value={form.original_url} onChange={e => setForm({ ...form, original_url: e.target.value })} />
            <input className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent text-sm" placeholder="Label" value={form.label} onChange={e => setForm({ ...form, label: e.target.value })} />
            <div className="grid grid-cols-3 gap-2">
              <input className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent text-sm" placeholder="UTM Source" value={form.utm_source} onChange={e => setForm({ ...form, utm_source: e.target.value })} />
              <input className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent text-sm" placeholder="UTM Medium" value={form.utm_medium} onChange={e => setForm({ ...form, utm_medium: e.target.value })} />
              <input className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent text-sm" placeholder="UTM Campaign" value={form.utm_campaign} onChange={e => setForm({ ...form, utm_campaign: e.target.value })} />
            </div>
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
