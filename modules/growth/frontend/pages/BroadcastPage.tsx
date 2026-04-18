import { useState } from 'react';
import { useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { Radio, Plus, Trash2, Users, Send, Calendar } from 'lucide-react';
import { growthApi } from '../../../../packages/ui/src/services/api';
import { Pagination } from '../../../../packages/ui/src/components/ui/Pagination';
import toast from 'react-hot-toast';

const PAGE_SIZE = 50;

interface Segment { id: string; name: string; filters: Record<string, unknown>; contact_count: number; created_at: string; }
interface Campaign { id: string; segment_id: string; name: string; channel: string; content: Record<string, unknown>; status: string; scheduled_at: string | null; sent_count: number; failed_count: number; created_at: string; }
interface Stats { total_segments: number; total_campaigns: number; total_sent: number; total_failed: number; scheduled_count: number; }

export default function BroadcastPage() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<'campaigns' | 'segments'>('campaigns');
  const [showCreateSegment, setShowCreateSegment] = useState(false);
  const [showCreateCampaign, setShowCreateCampaign] = useState(false);
  const [campPage, setCampPage] = useState(0);
  const [segPage, setSegPage] = useState(0);
  const [segForm, setSegForm] = useState({ name: '', filters: { tags: [], channel: '' } });
  const [campForm, setCampForm] = useState({ name: '', segment_id: '', channel: 'whatsapp', content: { message: '' }, status: 'draft' });

  const { data, isLoading: loading } = useQuery({
    queryKey: ['broadcast', campPage, segPage],
    queryFn: async () => {
      const [sg, cp, st] = await Promise.all([
        growthApi.broadcast.listSegments({ limit: PAGE_SIZE, offset: segPage * PAGE_SIZE }),
        growthApi.broadcast.listCampaigns({ limit: PAGE_SIZE, offset: campPage * PAGE_SIZE }),
        growthApi.broadcast.getStats(),
      ]);
      return {
        segments: (sg.segments ?? []) as Segment[], segTotal: sg.total ?? sg.segments?.length ?? 0,
        campaigns: (cp.campaigns ?? []) as Campaign[], campTotal: cp.total ?? cp.campaigns?.length ?? 0,
        stats: st.stats as Stats | null,
      };
    },
    staleTime: 30_000,
    refetchInterval: 60_000,
    placeholderData: keepPreviousData,
  });
  const segments = data?.segments ?? [];
  const segTotal = data?.segTotal ?? 0;
  const campaigns = data?.campaigns ?? [];
  const campTotal = data?.campTotal ?? 0;
  const stats = data?.stats ?? null;

  async function handleCreateSegment() {
    try { await growthApi.broadcast.createSegment(segForm); toast.success('Segment created'); setShowCreateSegment(false); queryClient.invalidateQueries({ queryKey: ['broadcast'] }); } catch { toast.error('Failed'); }
  }

  async function handleCreateCampaign() {
    try { await growthApi.broadcast.createCampaign(campForm); toast.success('Campaign created'); setShowCreateCampaign(false); queryClient.invalidateQueries({ queryKey: ['broadcast'] }); } catch { toast.error('Failed'); }
  }

  async function handleDeleteCampaign(id: string) {
    if (!confirm('Delete?')) return;
    try { await growthApi.broadcast.deleteCampaign(id); toast.success('Deleted'); queryClient.invalidateQueries({ queryKey: ['broadcast'] }); } catch { toast.error('Failed'); }
  }

  async function handleDeleteSegment(id: string) {
    if (!confirm('Delete?')) return;
    try { await growthApi.broadcast.deleteSegment(id); toast.success('Deleted'); queryClient.invalidateQueries({ queryKey: ['broadcast'] }); } catch { toast.error('Failed'); }
  }

  const statusBadge = (s: string) => {
    const m: Record<string, string> = { draft: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400', scheduled: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400', sending: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400', sent: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400', failed: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' };
    return m[s] ?? m.draft;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2"><Radio className="w-6 h-6 text-brand-600" /> Segmented Broadcast</h1>
        <div className="flex gap-2">
          <button onClick={() => setShowCreateCampaign(true)} className="flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 text-sm"><Send className="w-4 h-4" /> New Campaign</button>
          <button onClick={() => setShowCreateSegment(true)} className="flex items-center gap-2 px-4 py-2 bg-gray-200 dark:bg-gray-800 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-700 text-sm"><Users className="w-4 h-4" /> New Segment</button>
        </div>
      </div>

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {[
            { label: 'Segments', value: stats.total_segments }, { label: 'Campaigns', value: stats.total_campaigns },
            { label: 'Total Sent', value: stats.total_sent }, { label: 'Failed', value: stats.total_failed }, { label: 'Scheduled', value: stats.scheduled_count },
          ].map(c => (
            <div key={c.label} className="rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-4">
              <p className="text-sm text-gray-500">{c.label}</p><p className="text-2xl font-bold">{c.value}</p>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-2 border-b border-gray-200 dark:border-gray-800">
        {(['campaigns', 'segments'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 text-sm font-medium capitalize border-b-2 transition-colors ${tab === t ? 'border-brand-600 text-brand-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>{t}</button>
        ))}
      </div>

      {loading ? <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600" /></div>
      : tab === 'campaigns' ? (
        <div className="space-y-3">
          {campaigns.map(c => (
            <div key={c.id} className="rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-4 flex items-center justify-between">
              <div>
                <p className="font-medium">{c.name}</p>
                <p className="text-sm text-gray-500">via {c.channel} · {c.sent_count} sent · {c.failed_count} failed{c.scheduled_at ? ` · Scheduled: ${new Date(c.scheduled_at).toLocaleString()}` : ''}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusBadge(c.status)}`}>{c.status}</span>
                <button onClick={() => handleDeleteCampaign(c.id)} className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"><Trash2 className="w-4 h-4" /></button>
              </div>
            </div>
          ))}
          {!campaigns.length && <p className="text-center py-8 text-gray-500">No broadcast campaigns yet</p>}
          <Pagination page={campPage} pageSize={PAGE_SIZE} total={campTotal} onPageChange={setCampPage} />
        </div>
      ) : (
        <div className="space-y-3">
          {segments.map(s => (
            <div key={s.id} className="rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-4 flex items-center justify-between">
              <div>
                <p className="font-medium">{s.name}</p>
                <p className="text-sm text-gray-500">{s.contact_count} contacts · Filters: {JSON.stringify(s.filters).slice(0, 50)}</p>
              </div>
              <button onClick={() => handleDeleteSegment(s.id)} className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"><Trash2 className="w-4 h-4" /></button>
            </div>
          ))}
          {!segments.length && <p className="text-center py-8 text-gray-500">No segments yet</p>}
          <Pagination page={segPage} pageSize={PAGE_SIZE} total={segTotal} onPageChange={setSegPage} />
        </div>
      )}

      {showCreateSegment && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowCreateSegment(false)}>
          <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 w-full max-w-md shadow-xl" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold mb-4">New Segment</h2>
            <input value={segForm.name} onChange={e => setSegForm({ ...segForm, name: e.target.value })} placeholder="Segment name" className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent mb-3" />
            <div className="flex gap-2 mt-4">
              <button onClick={() => setShowCreateSegment(false)} className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm">Cancel</button>
              <button onClick={handleCreateSegment} className="flex-1 px-4 py-2 bg-brand-600 text-white rounded-lg text-sm hover:bg-brand-700">Create</button>
            </div>
          </div>
        </div>
      )}

      {showCreateCampaign && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowCreateCampaign(false)}>
          <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 w-full max-w-md shadow-xl" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold mb-4">New Broadcast Campaign</h2>
            <div className="space-y-3">
              <input value={campForm.name} onChange={e => setCampForm({ ...campForm, name: e.target.value })} placeholder="Campaign name" className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent" />
              <select value={campForm.segment_id} onChange={e => setCampForm({ ...campForm, segment_id: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent">
                <option value="">Select segment</option>
                {segments.map(s => <option key={s.id} value={s.id}>{s.name} ({s.contact_count})</option>)}
              </select>
              <select value={campForm.channel} onChange={e => setCampForm({ ...campForm, channel: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent">
                <option value="whatsapp">WhatsApp</option><option value="sms">SMS</option><option value="email">Email</option>
              </select>
              <textarea value={campForm.content.message as string} onChange={e => setCampForm({ ...campForm, content: { message: e.target.value } })} placeholder="Message content" rows={3} className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent" />
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={() => setShowCreateCampaign(false)} className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm">Cancel</button>
              <button onClick={handleCreateCampaign} className="flex-1 px-4 py-2 bg-brand-600 text-white rounded-lg text-sm hover:bg-brand-700">Create</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
