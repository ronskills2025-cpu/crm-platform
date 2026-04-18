import { useEffect, useState } from 'react';
import { Share2, Plus, Trophy, Link2, Users, TrendingUp } from 'lucide-react';
import { growthApi } from '../../../../packages/ui/src/services/api';
import toast from 'react-hot-toast';

interface Program { id: string; name: string; reward_type: string; reward_amount: number; is_active: boolean; created_at: string; }
interface RefLink { id: string; program_id: string; referrer_lead_id: string; code: string; clicks: number; conversions: number; created_at: string; }
interface Referral { id: string; referral_link_id: string; referred_name: string; referred_phone: string; status: string; created_at: string; }
interface Leaderboard { referrer_lead_id: string; total_referrals: number; total_conversions: number; }
interface Stats { total_programs: number; total_referrals: number; converted: number; pending: number; total_clicks: number; conversion_rate: string; }

export default function ReferralPage() {
  const [programs, setPrograms] = useState<Program[]>([]);
  const [links, setLinks] = useState<RefLink[]>([]);
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [leaderboard, setLeaderboard] = useState<Leaderboard[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'referrals' | 'links' | 'programs' | 'leaderboard'>('referrals');
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: '', reward_type: 'discount', reward_amount: 10, max_referrals_per_user: 50 });

  async function load() {
    setLoading(true);
    try {
      const [p, l, r, s] = await Promise.all([growthApi.referral.listPrograms(), growthApi.referral.listLinks(), growthApi.referral.listReferrals(), growthApi.referral.getStats()]);
      setPrograms(p.programs ?? []); setLinks(l.links ?? []); setReferrals(r.referrals ?? []); setStats(s.stats);
      if (p.programs?.length) {
        const lb = await growthApi.referral.getLeaderboard(p.programs[0].id);
        setLeaderboard(lb.leaderboard ?? []);
      }
    } finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  async function handleCreate() {
    try { await growthApi.referral.createProgram(form); toast.success('Program created'); setShowCreate(false); load(); } catch { toast.error('Failed'); }
  }

  async function handleConvert(id: string) {
    try { await growthApi.referral.convertReferral(id); toast.success('Converted'); load(); } catch { toast.error('Failed'); }
  }

  const statusBadge = (s: string) => {
    const m: Record<string, string> = { pending: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400', converted: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400', expired: 'bg-gray-100 text-gray-500 dark:bg-gray-800' };
    return m[s] ?? m.pending;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2"><Share2 className="w-6 h-6 text-brand-600" /> Referral System</h1>
        <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 text-sm"><Plus className="w-4 h-4" /> New Program</button>
      </div>

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {[
            { label: 'Total Referrals', value: stats.total_referrals, icon: Users },
            { label: 'Converted', value: stats.converted, icon: TrendingUp },
            { label: 'Pending', value: stats.pending, icon: Share2 },
            { label: 'Total Clicks', value: stats.total_clicks, icon: Link2 },
            { label: 'Conv. Rate', value: `${stats.conversion_rate}%`, icon: Trophy },
          ].map(c => (
            <div key={c.label} className="rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-4">
              <div className="flex items-center gap-2 text-sm text-gray-500 mb-1"><c.icon className="w-4 h-4" /> {c.label}</div>
              <p className="text-2xl font-bold">{c.value}</p>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-2 border-b border-gray-200 dark:border-gray-800">
        {(['referrals', 'links', 'programs', 'leaderboard'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 text-sm font-medium capitalize border-b-2 transition-colors ${tab === t ? 'border-brand-600 text-brand-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>{t}</button>
        ))}
      </div>

      {loading ? <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600" /></div>
      : tab === 'referrals' ? (
        <div className="space-y-2">
          {referrals.map(r => (
            <div key={r.id} className="rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-4 flex items-center justify-between">
              <div>
                <p className="font-medium">{r.referred_name}</p>
                <p className="text-sm text-gray-500">{r.referred_phone} · {new Date(r.created_at).toLocaleDateString()}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusBadge(r.status)}`}>{r.status}</span>
                {r.status === 'pending' && <button onClick={() => handleConvert(r.id)} className="px-3 py-1 text-xs bg-emerald-600 text-white rounded-lg hover:bg-emerald-700">Convert</button>}
              </div>
            </div>
          ))}
          {!referrals.length && <p className="text-center py-8 text-gray-500">No referrals yet</p>}
        </div>
      ) : tab === 'links' ? (
        <div className="space-y-2">
          {links.map(l => (
            <div key={l.id} className="rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-4 flex items-center justify-between">
              <div>
                <p className="font-mono text-sm">{l.code}</p>
                <p className="text-sm text-gray-500">{l.clicks} clicks · {l.conversions} conversions</p>
              </div>
              <button onClick={() => { navigator.clipboard.writeText(l.code); toast.success('Copied!'); }} className="p-2 text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-900/20 rounded-lg"><Link2 className="w-4 h-4" /></button>
            </div>
          ))}
          {!links.length && <p className="text-center py-8 text-gray-500">No referral links yet</p>}
        </div>
      ) : tab === 'programs' ? (
        <div className="space-y-3">
          {programs.map(p => (
            <div key={p.id} className="rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-4">
              <p className="font-medium">{p.name}</p>
              <p className="text-sm text-gray-500">{p.reward_type}: ${p.reward_amount} · {p.is_active ? '🟢' : '🔴'}</p>
            </div>
          ))}
          {!programs.length && <p className="text-center py-8 text-gray-500">No programs yet</p>}
        </div>
      ) : (
        <div className="space-y-2">
          {leaderboard.map((l, i) => (
            <div key={l.referrer_lead_id} className="rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-4 flex items-center gap-4">
              <span className={`w-8 h-8 flex items-center justify-center rounded-full font-bold text-sm ${i === 0 ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' : i === 1 ? 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300' : i === 2 ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'}`}>{i + 1}</span>
              <div className="flex-1">
                <p className="font-mono text-sm">{l.referrer_lead_id.slice(0, 12)}</p>
                <p className="text-sm text-gray-500">{l.total_referrals} referrals · {l.total_conversions} converted</p>
              </div>
            </div>
          ))}
          {!leaderboard.length && <p className="text-center py-8 text-gray-500">No data yet</p>}
        </div>
      )}

      {showCreate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowCreate(false)}>
          <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 w-full max-w-md shadow-xl" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold mb-4">New Referral Program</h2>
            <div className="space-y-3">
              <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Program name" className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent" />
              <select value={form.reward_type} onChange={e => setForm({ ...form, reward_type: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent">
                <option value="discount">Discount</option><option value="credit">Credit</option><option value="points">Points</option><option value="free_product">Free Product</option>
              </select>
              <input type="number" value={form.reward_amount} onChange={e => setForm({ ...form, reward_amount: +e.target.value })} placeholder="Reward amount" className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent" />
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
