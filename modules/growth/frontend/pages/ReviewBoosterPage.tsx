import { useEffect, useState } from 'react';
import { Star, Plus, Trash2, Send, ThumbsUp, ThumbsDown } from 'lucide-react';
import { growthApi } from '../../../../packages/ui/src/services/api';
import toast from 'react-hot-toast';

interface Campaign { id: string; name: string; channel: string; positive_redirect_url: string; negative_threshold: number; total_sent: number; total_responses: number; avg_rating: number | null; created_at: string; }
interface ReviewRequest { id: string; campaign_id: string; customer_name: string; customer_phone: string; status: string; rating: number | null; feedback: string | null; sent_at: string | null; responded_at: string | null; }
interface Stats { total_campaigns: number; total_requests: number; total_responses: number; avg_rating: string; positive_count: number; negative_count: number; response_rate: string; }

export default function ReviewBoosterPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [requests, setRequests] = useState<ReviewRequest[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'campaigns' | 'requests'>('campaigns');
  const [selectedCampaign, setSelectedCampaign] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: '', channel: 'sms', positive_redirect_url: 'https://g.page/review/', negative_threshold: 3, message_template: 'Hi {{name}}, how was your experience? Rate us: {{link}}' });

  async function load() {
    setLoading(true);
    try {
      const [c, s] = await Promise.all([growthApi.reviews.listCampaigns(), growthApi.reviews.getStats()]);
      setCampaigns(c.campaigns ?? []); setStats(s.stats);
      if (c.campaigns?.length) {
        const cid = selectedCampaign ?? c.campaigns[0].id;
        setSelectedCampaign(cid);
        const r = await growthApi.reviews.listRequests(cid);
        setRequests(r.requests ?? []);
      }
    } finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  async function handleCreate() {
    try { await growthApi.reviews.createCampaign(form); toast.success('Campaign created'); setShowCreate(false); load(); } catch { toast.error('Failed'); }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete?')) return;
    try { await growthApi.reviews.deleteCampaign(id); toast.success('Deleted'); load(); } catch { toast.error('Failed'); }
  }

  async function selectCampaign(id: string) {
    setSelectedCampaign(id);
    const r = await growthApi.reviews.listRequests(id);
    setRequests(r.requests ?? []);
  }

  const ratingStars = (r: number | null) => r ? '★'.repeat(r) + '☆'.repeat(5 - r) : '—';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2"><Star className="w-6 h-6 text-brand-600" /> Review Booster</h1>
        <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 text-sm"><Plus className="w-4 h-4" /> New Campaign</button>
      </div>

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Campaigns', value: stats.total_campaigns },
            { label: 'Avg Rating', value: `${stats.avg_rating} ★` },
            { label: 'Response Rate', value: `${stats.response_rate}%` },
            { label: 'Positive / Negative', value: `${stats.positive_count} / ${stats.negative_count}` },
          ].map(c => (
            <div key={c.label} className="rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-4">
              <p className="text-sm text-gray-500">{c.label}</p><p className="text-2xl font-bold">{c.value}</p>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-2 border-b border-gray-200 dark:border-gray-800">
        {(['campaigns', 'requests'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 text-sm font-medium capitalize border-b-2 transition-colors ${tab === t ? 'border-brand-600 text-brand-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>{t}</button>
        ))}
      </div>

      {loading ? <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600" /></div>
      : tab === 'campaigns' ? (
        <div className="space-y-3">
          {campaigns.map(c => (
            <div key={c.id} onClick={() => { selectCampaign(c.id); setTab('requests'); }} className="rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-4 cursor-pointer hover:border-brand-300 flex items-center justify-between">
              <div>
                <p className="font-medium">{c.name}</p>
                <p className="text-sm text-gray-500">via {c.channel} · {c.total_sent} sent · {c.total_responses} responses · Avg: {c.avg_rating ? `${c.avg_rating.toFixed(1)} ★` : '—'}</p>
              </div>
              <button onClick={e => { e.stopPropagation(); handleDelete(c.id); }} className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"><Trash2 className="w-4 h-4" /></button>
            </div>
          ))}
          {!campaigns.length && <p className="text-center py-8 text-gray-500">No campaigns yet</p>}
        </div>
      ) : (
        <div>
          {selectedCampaign && (
            <select value={selectedCampaign} onChange={e => selectCampaign(e.target.value)} className="mb-4 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent text-sm">
              {campaigns.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          )}
          <div className="space-y-2">
            {requests.map(r => (
              <div key={r.id} className="rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-4 flex items-center justify-between">
                <div>
                  <p className="font-medium">{r.customer_name}</p>
                  <p className="text-sm text-gray-500">{r.customer_phone} · {r.status}</p>
                  {r.rating && <p className="text-sm mt-1">{ratingStars(r.rating)} {r.feedback ? `— "${r.feedback}"` : ''}</p>}
                </div>
                <div className="flex items-center gap-2">
                  {r.rating && r.rating >= 4 ? <ThumbsUp className="w-4 h-4 text-emerald-500" /> : r.rating ? <ThumbsDown className="w-4 h-4 text-red-500" /> : <Send className="w-4 h-4 text-gray-400" />}
                </div>
              </div>
            ))}
            {!requests.length && <p className="text-center py-8 text-gray-500">No requests yet</p>}
          </div>
        </div>
      )}

      {showCreate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowCreate(false)}>
          <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 w-full max-w-md shadow-xl" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold mb-4">New Review Campaign</h2>
            <div className="space-y-3">
              <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Campaign name" className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent" />
              <select value={form.channel} onChange={e => setForm({ ...form, channel: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent">
                <option value="sms">SMS</option><option value="whatsapp">WhatsApp</option><option value="email">Email</option>
              </select>
              <input value={form.positive_redirect_url} onChange={e => setForm({ ...form, positive_redirect_url: e.target.value })} placeholder="Google Review URL" className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent" />
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
