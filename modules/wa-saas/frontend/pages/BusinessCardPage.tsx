import { useEffect, useState } from 'react';
import { CreditCard, Plus, Trash2, Play, Pause, Users } from 'lucide-react';
import { waSaasApi } from '../../../../packages/ui/src/services/api';
import toast from 'react-hot-toast';

interface Card { id: string; name: string; title: string; company: string; phone: string; email: string; website: string; keyword: string; is_active: boolean; created_at: string; }
interface Lead { id: string; card_id: string; name: string; phone: string; email: string; created_at: string; }
interface Stats { total_cards: number; active_cards: number; total_leads: number; }

export default function BusinessCardPage() {
  const [cards, setCards] = useState<Card[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'cards' | 'leads'>('cards');
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: '', title: '', company: '', phone: '', email: '', website: '', keyword: '', social_links: {} });

  async function load() {
    setLoading(true);
    try {
      const [c, l, s] = await Promise.all([waSaasApi.businessCards.list(), waSaasApi.businessCards.listLeads(), waSaasApi.businessCards.getStats()]);
      setCards(c.cards ?? []); setLeads(l.leads ?? []); setStats(s.stats);
    } finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  async function handleCreate() {
    try { await waSaasApi.businessCards.create(form); toast.success('Card created'); setShowCreate(false); load(); } catch { toast.error('Failed'); }
  }

  async function handleToggle(id: string) {
    try { await waSaasApi.businessCards.toggle(id); toast.success('Toggled'); load(); } catch { toast.error('Failed'); }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete card?')) return;
    try { await waSaasApi.businessCards.delete(id); toast.success('Deleted'); load(); } catch { toast.error('Failed'); }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2"><CreditCard className="w-6 h-6 text-brand-600" /> Business Card Bot</h1>
        <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 text-sm"><Plus className="w-4 h-4" /> New Card</button>
      </div>

      {stats && (
        <div className="grid grid-cols-3 gap-4">
          {[{ label: 'Cards', value: stats.total_cards }, { label: 'Active', value: stats.active_cards }, { label: 'Leads', value: stats.total_leads }].map(c => (
            <div key={c.label} className="rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-4">
              <p className="text-sm text-gray-500">{c.label}</p><p className="text-2xl font-bold">{c.value}</p>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-2 border-b border-gray-200 dark:border-gray-800">
        {(['cards', 'leads'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === t ? 'border-brand-600 text-brand-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>{t === 'cards' ? 'Cards' : 'Leads'}</button>
        ))}
      </div>

      {loading ? <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600" /></div>
      : tab === 'cards' ? (
        <div className="space-y-3">
          {cards.map(c => (
            <div key={c.id} className="rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-4 flex items-center justify-between">
              <div>
                <p className="font-medium">{c.name} — {c.title}</p>
                <p className="text-sm text-gray-500">{c.company} · {c.phone} · Keyword: <span className="font-mono text-brand-600">{c.keyword}</span></p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => handleToggle(c.id)} className={`p-2 rounded-lg ${c.is_active ? 'text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/20' : 'text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/20'}`}>
                  {c.is_active ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                </button>
                <button onClick={() => handleDelete(c.id)} className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"><Trash2 className="w-4 h-4" /></button>
              </div>
            </div>
          ))}
          {!cards.length && <p className="text-center py-8 text-gray-500">No business cards yet</p>}
        </div>
      ) : (
        <div className="space-y-2">
          {leads.map(l => (
            <div key={l.id} className="rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-4">
              <p className="font-medium">{l.name}</p>
              <p className="text-sm text-gray-500">{l.phone} · {l.email} · {new Date(l.created_at).toLocaleDateString()}</p>
            </div>
          ))}
          {!leads.length && <p className="text-center py-8 text-gray-500">No leads captured yet</p>}
        </div>
      )}

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowCreate(false)}>
          <div className="bg-white dark:bg-gray-900 rounded-xl p-6 w-full max-w-md space-y-4 max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold">New Business Card</h2>
            <input className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent text-sm" placeholder="Your name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
            <input className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent text-sm" placeholder="Title" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
            <input className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent text-sm" placeholder="Company" value={form.company} onChange={e => setForm({ ...form, company: e.target.value })} />
            <div className="grid grid-cols-2 gap-2">
              <input className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent text-sm" placeholder="Phone" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
              <input className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent text-sm" placeholder="Email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
            </div>
            <input className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent text-sm" placeholder="Website" value={form.website} onChange={e => setForm({ ...form, website: e.target.value })} />
            <input className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent text-sm" placeholder="WhatsApp keyword trigger" value={form.keyword} onChange={e => setForm({ ...form, keyword: e.target.value })} />
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
