import { useEffect, useState } from 'react';
import { BarChart3, Plus, Trash2, DollarSign, TrendingUp, MousePointerClick } from 'lucide-react';
import { growthApi } from '../../../../packages/ui/src/services/api';
import toast from 'react-hot-toast';

interface AdCampaign { id: string; name: string; platform: string; campaign_id_external: string | null; budget: number; spent: number; leads_generated: number; conversions: number; cost_per_lead: number; cost_per_acquisition: number; roas: number; status: string; start_date: string; end_date: string | null; }
interface ROI { id: string; name: string; platform: string; budget: number; spent: number; leads_generated: number; conversions: number; cost_per_lead: number; cost_per_acquisition: number; roas: number; revenue: number; }
interface PlatformStats { platform: string; total_campaigns: number; total_budget: number; total_spent: number; total_leads: number; total_conversions: number; avg_cpl: number; }

export default function AdsTrackerPage() {
  const [campaigns, setCampaigns] = useState<AdCampaign[]>([]);
  const [roi, setRoi] = useState<ROI[]>([]);
  const [platforms, setPlatforms] = useState<PlatformStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'campaigns' | 'roi' | 'platforms'>('campaigns');
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: '', platform: 'google', budget: 0, start_date: new Date().toISOString().split('T')[0] });

  async function load() {
    setLoading(true);
    try {
      const [c, r, p] = await Promise.all([growthApi.ads.listCampaigns(), growthApi.ads.getROI(), growthApi.ads.getByPlatform()]);
      setCampaigns(c.campaigns ?? []); setRoi(r.roi ?? []); setPlatforms(p.platforms ?? []);
    } finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  async function handleCreate() {
    try { await growthApi.ads.createCampaign(form); toast.success('Campaign created'); setShowCreate(false); load(); } catch { toast.error('Failed'); }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete?')) return;
    try { await growthApi.ads.deleteCampaign(id); toast.success('Deleted'); load(); } catch { toast.error('Failed'); }
  }

  const statusBadge = (s: string) => {
    const m: Record<string, string> = { active: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400', paused: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400', completed: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400', draft: 'bg-gray-100 text-gray-500 dark:bg-gray-800' };
    return m[s] ?? m.draft;
  };

  const platformIcon: Record<string, string> = { google: '🔍', facebook: '📘', instagram: '📸', tiktok: '🎵', linkedin: '💼', twitter: '🐦' };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2"><BarChart3 className="w-6 h-6 text-brand-600" /> Ads Performance Tracker</h1>
        <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 text-sm"><Plus className="w-4 h-4" /> New Campaign</button>
      </div>

      {platforms.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {platforms.map(p => (
            <div key={p.platform} className="rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-4">
              <div className="flex items-center gap-2 mb-2"><span className="text-xl">{platformIcon[p.platform] ?? '📊'}</span><span className="font-medium capitalize">{p.platform}</span></div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div><p className="text-gray-500">Budget</p><p className="font-semibold">${p.total_budget.toLocaleString()}</p></div>
                <div><p className="text-gray-500">Spent</p><p className="font-semibold">${p.total_spent.toLocaleString()}</p></div>
                <div><p className="text-gray-500">Leads</p><p className="font-semibold">{p.total_leads}</p></div>
                <div><p className="text-gray-500">Avg CPL</p><p className="font-semibold">${p.avg_cpl?.toFixed(2) ?? '—'}</p></div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-2 border-b border-gray-200 dark:border-gray-800">
        {(['campaigns', 'roi', 'platforms'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 text-sm font-medium capitalize border-b-2 transition-colors ${tab === t ? 'border-brand-600 text-brand-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>{t === 'roi' ? 'ROI Dashboard' : t}</button>
        ))}
      </div>

      {loading ? <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600" /></div>
      : tab === 'campaigns' ? (
        <div className="space-y-3">
          {campaigns.map(c => (
            <div key={c.id} className="rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-4 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2"><span>{platformIcon[c.platform] ?? '📊'}</span><p className="font-medium">{c.name}</p></div>
                <p className="text-sm text-gray-500">Budget: ${c.budget.toLocaleString()} · Spent: ${c.spent.toLocaleString()} · {c.leads_generated} leads · {c.conversions} conversions</p>
                <p className="text-xs text-gray-400 mt-1">CPL: ${c.cost_per_lead.toFixed(2)} · CPA: ${c.cost_per_acquisition.toFixed(2)} · ROAS: {c.roas.toFixed(2)}x</p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusBadge(c.status)}`}>{c.status}</span>
                <button onClick={() => handleDelete(c.id)} className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"><Trash2 className="w-4 h-4" /></button>
              </div>
            </div>
          ))}
          {!campaigns.length && <p className="text-center py-8 text-gray-500">No ad campaigns yet</p>}
        </div>
      ) : tab === 'roi' ? (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-gray-200 dark:border-gray-800 text-left text-gray-500">
              <th className="py-2 px-3">Campaign</th><th className="py-2 px-3">Platform</th><th className="py-2 px-3">Budget</th><th className="py-2 px-3">Spent</th><th className="py-2 px-3">Revenue</th><th className="py-2 px-3">ROAS</th><th className="py-2 px-3">CPL</th>
            </tr></thead>
            <tbody>
              {roi.map(r => (
                <tr key={r.id} className="border-b border-gray-100 dark:border-gray-800/50">
                  <td className="py-2 px-3 font-medium">{r.name}</td>
                  <td className="py-2 px-3 capitalize">{r.platform}</td>
                  <td className="py-2 px-3">${r.budget.toLocaleString()}</td>
                  <td className="py-2 px-3">${r.spent.toLocaleString()}</td>
                  <td className="py-2 px-3 text-emerald-600 font-semibold">${r.revenue?.toLocaleString() ?? 0}</td>
                  <td className="py-2 px-3">{r.roas.toFixed(2)}x</td>
                  <td className="py-2 px-3">${r.cost_per_lead.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!roi.length && <p className="text-center py-8 text-gray-500">No ROI data yet</p>}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {platforms.map(p => (
            <div key={p.platform} className="rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-4">
              <h3 className="font-medium capitalize mb-3">{platformIcon[p.platform] ?? '📊'} {p.platform}</h3>
              <div className="grid grid-cols-3 gap-3 text-sm">
                <div><p className="text-gray-500">Campaigns</p><p className="font-bold">{p.total_campaigns}</p></div>
                <div><p className="text-gray-500">Total Leads</p><p className="font-bold">{p.total_leads}</p></div>
                <div><p className="text-gray-500">Conversions</p><p className="font-bold">{p.total_conversions}</p></div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showCreate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowCreate(false)}>
          <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 w-full max-w-md shadow-xl" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold mb-4">New Ad Campaign</h2>
            <div className="space-y-3">
              <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Campaign name" className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent" />
              <select value={form.platform} onChange={e => setForm({ ...form, platform: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent">
                <option value="google">Google Ads</option><option value="facebook">Facebook</option><option value="instagram">Instagram</option><option value="tiktok">TikTok</option><option value="linkedin">LinkedIn</option>
              </select>
              <input type="number" value={form.budget} onChange={e => setForm({ ...form, budget: +e.target.value })} placeholder="Budget ($)" className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent" />
              <input type="date" value={form.start_date} onChange={e => setForm({ ...form, start_date: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent" />
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
