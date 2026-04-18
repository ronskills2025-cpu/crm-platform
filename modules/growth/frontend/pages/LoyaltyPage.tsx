import { useState } from 'react';
import { useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { Crown, Plus, Users, Gift, TrendingUp } from 'lucide-react';
import { growthApi } from '../../../../packages/ui/src/services/api';
import { Pagination } from '../../../../packages/ui/src/components/ui/Pagination';
import toast from 'react-hot-toast';

const PAGE_SIZE = 50;

interface Program { id: string; name: string; points_per_dollar: number; tiers: unknown; is_active: boolean; created_at: string; }
interface Member { id: string; lead_id: string; program_id: string; points_balance: number; lifetime_points: number; tier: string; joined_at: string; }
interface Reward { id: string; program_id: string; name: string; points_cost: number; reward_type: string; is_active: boolean; }
interface Stats { total_programs: number; total_members: number; total_points_issued: number; total_points_redeemed: number; active_programs: number; }

const tierColor: Record<string, string> = {
  bronze: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  silver: 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
  gold: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  platinum: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
};

export default function LoyaltyPage() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<'members' | 'programs' | 'rewards'>('members');
  const [memberPage, setMemberPage] = useState(0);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: '', points_per_dollar: 10, tiers: { bronze: 0, silver: 500, gold: 2000, platinum: 5000 } });

  const { data, isLoading: loading } = useQuery({
    queryKey: ['loyalty', memberPage],
    queryFn: async () => {
      const [p, m, r, s] = await Promise.all([
        growthApi.loyalty.listPrograms().catch(() => ({ programs: [] })),
        growthApi.loyalty.listMembers({ limit: PAGE_SIZE, offset: memberPage * PAGE_SIZE }).catch(() => ({ members: [], total: 0 })),
        growthApi.loyalty.listRewards().catch(() => ({ rewards: [] })),
        growthApi.loyalty.getStats().catch(() => ({ stats: null })),
      ]);
      return {
        programs: (p.programs ?? []) as Program[],
        members: (m.members ?? []) as Member[], memberTotal: m.total ?? m.members?.length ?? 0,
        rewards: (r.rewards ?? []) as Reward[],
        stats: (s.stats ?? null) as Stats | null,
      };
    },
    staleTime: 30_000,
    refetchInterval: 60_000,
    placeholderData: keepPreviousData,
  });
  const programs = data?.programs ?? [];
  const members = data?.members ?? [];
  const memberTotal = data?.memberTotal ?? 0;
  const rewards = data?.rewards ?? [];
  const stats = data?.stats ?? null;

  async function handleCreate() {
    try { await growthApi.loyalty.createProgram(form); toast.success('Program created'); setShowCreate(false); queryClient.invalidateQueries({ queryKey: ['loyalty'] }); } catch { toast.error('Failed'); }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2"><Crown className="w-6 h-6 text-brand-600" /> Loyalty Program</h1>
        <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 text-sm"><Plus className="w-4 h-4" /> New Program</button>
      </div>

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {[
            { label: 'Programs', value: stats.total_programs, icon: Crown },
            { label: 'Members', value: stats.total_members, icon: Users },
            { label: 'Points Issued', value: stats.total_points_issued.toLocaleString(), icon: TrendingUp },
            { label: 'Redeemed', value: stats.total_points_redeemed.toLocaleString(), icon: Gift },
            { label: 'Active', value: stats.active_programs, icon: Crown },
          ].map(c => (
            <div key={c.label} className="rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-4">
              <div className="flex items-center gap-2 text-sm text-gray-500 mb-1"><c.icon className="w-4 h-4" /> {c.label}</div>
              <p className="text-2xl font-bold">{c.value}</p>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-2 border-b border-gray-200 dark:border-gray-800">
        {(['members', 'programs', 'rewards'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 text-sm font-medium capitalize border-b-2 transition-colors ${tab === t ? 'border-brand-600 text-brand-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>{t}</button>
        ))}
      </div>

      {loading ? <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600" /></div>
      : tab === 'members' ? (
        <div className="space-y-2">
          {members.map(m => (
            <div key={m.id} className="rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-4 flex items-center justify-between">
              <div>
                <p className="font-mono text-sm">{m.lead_id.slice(0, 8)}</p>
                <p className="text-sm text-gray-500">{m.points_balance} pts · Lifetime: {m.lifetime_points}</p>
              </div>
              <span className={`px-2 py-1 rounded-full text-xs font-medium capitalize ${tierColor[m.tier] ?? tierColor.bronze}`}>{m.tier}</span>
            </div>
          ))}
          {!members.length && <p className="text-center py-8 text-gray-500">No members yet</p>}
          <Pagination page={memberPage} pageSize={PAGE_SIZE} total={memberTotal} onPageChange={setMemberPage} />
        </div>
      ) : tab === 'programs' ? (
        <div className="space-y-3">
          {programs.map(p => (
            <div key={p.id} className="rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-4">
              <p className="font-medium">{p.name}</p>
              <p className="text-sm text-gray-500">{p.points_per_dollar} pts/$ · {p.is_active ? '🟢 Active' : '🔴 Inactive'}</p>
            </div>
          ))}
          {!programs.length && <p className="text-center py-8 text-gray-500">No programs yet</p>}
        </div>
      ) : (
        <div className="space-y-2">
          {rewards.map(r => (
            <div key={r.id} className="rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-4 flex items-center justify-between">
              <div><p className="font-medium">{r.name}</p><p className="text-sm text-gray-500">{r.reward_type} · {r.points_cost} pts</p></div>
              <span className={`px-2 py-1 rounded-full text-xs ${r.is_active ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'}`}>{r.is_active ? 'Active' : 'Inactive'}</span>
            </div>
          ))}
          {!rewards.length && <p className="text-center py-8 text-gray-500">No rewards yet</p>}
        </div>
      )}

      {showCreate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowCreate(false)}>
          <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 w-full max-w-md shadow-xl" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold mb-4">New Loyalty Program</h2>
            <div className="space-y-3">
              <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Program name" className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent" />
              <div>
                <label className="text-sm text-gray-500">Points per dollar</label>
                <input type="number" value={form.points_per_dollar} onChange={e => setForm({ ...form, points_per_dollar: +e.target.value })} className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent" />
              </div>
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
