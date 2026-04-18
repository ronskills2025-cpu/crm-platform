import { useState } from 'react';
import { useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { Kanban, Plus, Trash2, DollarSign, TrendingUp, ArrowRight } from 'lucide-react';
import { growthApi } from '../../../../packages/ui/src/services/api';
import { Pagination } from '../../../../packages/ui/src/components/ui/Pagination';
import toast from 'react-hot-toast';

const PAGE_SIZE = 50;

interface Pipeline { id: string; name: string; stages: string[]; is_default: boolean; created_at: string; }
interface Deal { id: string; pipeline_id: string; title: string; contact_name: string; contact_phone: string; value: number; stage: string; position: number; closed_at: string | null; created_at: string; }
interface Stats { total_pipelines: number; total_deals: number; total_value: number; won_deals: number; won_value: number; avg_deal_value: number; }

const stageColor = (i: number) => {
  const colors = ['bg-blue-500', 'bg-indigo-500', 'bg-purple-500', 'bg-amber-500', 'bg-emerald-500', 'bg-green-600'];
  return colors[i % colors.length];
};

export default function PipelinePage() {
  const queryClient = useQueryClient();
  const [activePipeline, setActivePipeline] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showCreateDeal, setShowCreateDeal] = useState(false);
  const [form, setForm] = useState({ name: '', stages: ['Lead', 'Contacted', 'Qualified', 'Proposal', 'Won', 'Lost'] });
  const [dealForm, setDealForm] = useState({ title: '', contact_name: '', contact_phone: '', value: 0, pipeline_id: '', stage: '' });
  const [dealPage, setDealPage] = useState(0);

  const { data: mainData, isLoading: loadingMain } = useQuery({
    queryKey: ['pipeline-main'],
    queryFn: async () => {
      const [p, s] = await Promise.all([
        growthApi.pipeline.listPipelines().catch(() => ({ pipelines: [] })),
        growthApi.pipeline.getStats().catch(() => ({ stats: { total_pipelines: 0, total_deals: 0, total_value: 0, won_deals: 0, won_value: 0, avg_deal_value: 0 } })),
      ]);
      return { pipelines: (p.pipelines ?? []) as Pipeline[], stats: (s.stats ?? null) as Stats | null };
    },
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
  const pipelines = mainData?.pipelines ?? [];
  const stats = mainData?.stats ?? null;
  const effectivePipeline = activePipeline ?? pipelines[0]?.id ?? null;

  const { data: dealData, isLoading: loadingDeals } = useQuery({
    queryKey: ['pipeline-deals', effectivePipeline, dealPage],
    queryFn: () => growthApi.pipeline.listDeals({ pipeline_id: effectivePipeline!, limit: PAGE_SIZE, offset: dealPage * PAGE_SIZE }).catch(() => ({ deals: [], total: 0 })),
    enabled: !!effectivePipeline,
    staleTime: 30_000,
    refetchInterval: 60_000,
    placeholderData: keepPreviousData,
  });
  const deals: Deal[] = (dealData as any)?.deals ?? [];
  const dealTotal: number = (dealData as any)?.total ?? 0;
  const loading = loadingMain || loadingDeals;

  function selectPipeline(id: string) {
    setActivePipeline(id);
    setDealPage(0);
  }

  async function handleCreate() {
    try { await growthApi.pipeline.createPipeline(form); toast.success('Pipeline created'); setShowCreate(false); queryClient.invalidateQueries({ queryKey: ['pipeline-main'] }); } catch { toast.error('Failed'); }
  }

  async function handleCreateDeal() {
    try { await growthApi.pipeline.createDeal({ ...dealForm, pipeline_id: activePipeline }); toast.success('Deal created'); setShowCreateDeal(false); queryClient.invalidateQueries({ queryKey: ['pipeline-deals'] }); } catch { toast.error('Failed'); }
  }

  async function handleMoveDeal(id: string, stage: string) {
    try { await growthApi.pipeline.moveDeal(id, { stage, position: 0 }); queryClient.invalidateQueries({ queryKey: ['pipeline-deals'] }); } catch { toast.error('Failed to move deal'); }
  }

  async function handleDeleteDeal(id: string) {
    if (!confirm('Delete deal?')) return;
    try { await growthApi.pipeline.deleteDeal(id); toast.success('Deleted'); queryClient.invalidateQueries({ queryKey: ['pipeline-deals'] }); } catch { toast.error('Failed'); }
  }

  const currentPipeline = pipelines.find(p => p.id === effectivePipeline);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2"><Kanban className="w-6 h-6 text-brand-600" /> Sales Pipeline</h1>
        <div className="flex gap-2">
          <button onClick={() => setShowCreateDeal(true)} className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm"><Plus className="w-4 h-4" /> New Deal</button>
          <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 text-sm"><Plus className="w-4 h-4" /> New Pipeline</button>
        </div>
      </div>

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Total Deals', value: stats.total_deals, icon: Kanban },
            { label: 'Total Value', value: `$${(stats.total_value || 0).toLocaleString()}`, icon: DollarSign },
            { label: 'Won Deals', value: stats.won_deals, icon: TrendingUp },
            { label: 'Avg Deal', value: `$${Math.round(stats.avg_deal_value || 0).toLocaleString()}`, icon: DollarSign },
          ].map(c => (
            <div key={c.label} className="rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-4">
              <div className="flex items-center gap-2 text-sm text-gray-500 mb-1"><c.icon className="w-4 h-4" /> {c.label}</div>
              <p className="text-2xl font-bold">{c.value}</p>
            </div>
          ))}
        </div>
      )}

      {pipelines.length > 1 && (
        <div className="flex gap-2">
          {pipelines.map(p => (
            <button key={p.id} onClick={() => selectPipeline(p.id)} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${p.id === activePipeline ? 'bg-brand-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'}`}>{p.name}</button>
          ))}
        </div>
      )}

      {loading ? <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600" /></div>
      : currentPipeline ? (
        <>
          <div className="flex gap-4 overflow-x-auto pb-4">
            {currentPipeline.stages.map((stage, i) => {
              const stageDeals = deals.filter(d => d.stage === stage);
              return (
                <div key={stage} className="min-w-[280px] flex-shrink-0">
                  <div className="flex items-center gap-2 mb-3">
                    <div className={`w-3 h-3 rounded-full ${stageColor(i)}`} />
                    <h3 className="font-medium text-sm">{stage}</h3>
                    <span className="text-xs text-gray-400">({stageDeals.length})</span>
                  </div>
                  <div className="space-y-2">
                    {stageDeals.map(d => (
                      <div key={d.id} className="rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-3 group">
                        <div className="flex items-start justify-between">
                          <p className="font-medium text-sm">{d.title}</p>
                          <button onClick={() => handleDeleteDeal(d.id)} className="p-1 opacity-0 group-hover:opacity-100 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"><Trash2 className="w-3 h-3" /></button>
                        </div>
                        <p className="text-xs text-gray-500">{d.contact_name} · {d.contact_phone}</p>
                        <div className="flex items-center justify-between mt-2">
                          <span className="text-sm font-semibold text-emerald-600">${d.value.toLocaleString()}</span>
                          {i < currentPipeline.stages.length - 1 && (
                            <button onClick={() => handleMoveDeal(d.id, currentPipeline.stages[i + 1])} className="p-1 text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-900/20 rounded" title={`Move to ${currentPipeline.stages[i + 1]}`}><ArrowRight className="w-3 h-3" /></button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
          <Pagination page={dealPage} pageSize={PAGE_SIZE} total={dealTotal} onPageChange={setDealPage} />
        </>
      ) : <p className="text-center py-8 text-gray-500">Create a pipeline to get started</p>}

      {showCreate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowCreate(false)}>
          <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 w-full max-w-md shadow-xl" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold mb-4">New Pipeline</h2>
            <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Pipeline name" className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent mb-3" />
            <p className="text-xs text-gray-500 mb-2">Stages: {form.stages.join(' → ')}</p>
            <div className="flex gap-2 mt-4">
              <button onClick={() => setShowCreate(false)} className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm">Cancel</button>
              <button onClick={handleCreate} className="flex-1 px-4 py-2 bg-brand-600 text-white rounded-lg text-sm hover:bg-brand-700">Create</button>
            </div>
          </div>
        </div>
      )}

      {showCreateDeal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowCreateDeal(false)}>
          <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 w-full max-w-md shadow-xl" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold mb-4">New Deal</h2>
            <div className="space-y-3">
              <input value={dealForm.title} onChange={e => setDealForm({ ...dealForm, title: e.target.value })} placeholder="Deal title" className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent" />
              <input value={dealForm.contact_name} onChange={e => setDealForm({ ...dealForm, contact_name: e.target.value })} placeholder="Contact name" className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent" />
              <input value={dealForm.contact_phone} onChange={e => setDealForm({ ...dealForm, contact_phone: e.target.value })} placeholder="Contact phone" className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent" />
              <input type="number" value={dealForm.value} onChange={e => setDealForm({ ...dealForm, value: +e.target.value })} placeholder="Deal value ($)" className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent" />
              {currentPipeline && (
                <select value={dealForm.stage} onChange={e => setDealForm({ ...dealForm, stage: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent">
                  <option value="">Select stage</option>
                  {currentPipeline.stages.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              )}
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={() => setShowCreateDeal(false)} className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm">Cancel</button>
              <button onClick={handleCreateDeal} className="flex-1 px-4 py-2 bg-brand-600 text-white rounded-lg text-sm hover:bg-brand-700">Create</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
