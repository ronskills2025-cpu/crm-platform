import { useEffect, useState } from 'react';
import { Bot, Plus, Trash2, Play, Pause, MessageSquare } from 'lucide-react';
import { waSaasApi } from '../../../../packages/ui/src/services/api';
import toast from 'react-hot-toast';

interface Config { id: string; name: string; greeting_message: string; fallback_message: string; is_active: boolean; ai_model: string; created_at: string; }
interface Conversation { id: string; phone: string; status: string; message_count: number; started_at: string; }
interface Stats { total_configs: number; active_configs: number; total_conversations: number; open_conversations: number; total_faqs: number; }

export default function AiBotPage() {
  const [configs, setConfigs] = useState<Config[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'configs' | 'conversations'>('configs');
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: '', greeting_message: 'Hi! How can I help you?', fallback_message: 'Let me connect you with a human agent.', ai_model: 'gpt-4o-mini' });

  async function load() {
    setLoading(true);
    try {
      const [c, cv, s] = await Promise.all([waSaasApi.aiBot.listConfigs(), waSaasApi.aiBot.listConversations(), waSaasApi.aiBot.getStats()]);
      setConfigs(c.configs ?? []); setConversations(cv.conversations ?? []); setStats(s.stats);
    } finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  async function handleCreate() {
    try { await waSaasApi.aiBot.createConfig(form); toast.success('Bot config created'); setShowCreate(false); load(); } catch { toast.error('Failed'); }
  }

  async function handleToggle(id: string) {
    try { await waSaasApi.aiBot.toggleConfig(id); toast.success('Toggled'); load(); } catch { toast.error('Failed'); }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete config?')) return;
    try { await waSaasApi.aiBot.deleteConfig(id); toast.success('Deleted'); load(); } catch { toast.error('Failed'); }
  }

  async function handleTakeover(id: string) {
    try { await waSaasApi.aiBot.conversationAction(id, { action: 'takeover' }); toast.success('Taken over'); load(); } catch { toast.error('Failed'); }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2"><Bot className="w-6 h-6 text-brand-600" /> AI Auto-Reply Bot</h1>
        <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 text-sm"><Plus className="w-4 h-4" /> New Config</button>
      </div>

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {[
            { label: 'Configs', value: stats.total_configs }, { label: 'Active', value: stats.active_configs },
            { label: 'Conversations', value: stats.total_conversations }, { label: 'Open', value: stats.open_conversations },
            { label: 'FAQs', value: stats.total_faqs },
          ].map(c => (
            <div key={c.label} className="rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-4">
              <p className="text-sm text-gray-500">{c.label}</p><p className="text-2xl font-bold">{c.value}</p>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-2 border-b border-gray-200 dark:border-gray-800">
        {(['configs', 'conversations'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === t ? 'border-brand-600 text-brand-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>{t === 'configs' ? 'Bot Configs' : 'Conversations'}</button>
        ))}
      </div>

      {loading ? <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600" /></div>
      : tab === 'configs' ? (
        <div className="space-y-3">
          {configs.map(c => (
            <div key={c.id} className="rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-4 flex items-center justify-between">
              <div>
                <p className="font-medium">{c.name}</p>
                <p className="text-sm text-gray-500">Model: {c.ai_model} · Greeting: {c.greeting_message.slice(0, 40)}...</p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => handleToggle(c.id)} className={`p-2 rounded-lg ${c.is_active ? 'text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/20' : 'text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/20'}`}>
                  {c.is_active ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                </button>
                <button onClick={() => handleDelete(c.id)} className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"><Trash2 className="w-4 h-4" /></button>
              </div>
            </div>
          ))}
          {!configs.length && <p className="text-center py-8 text-gray-500">No bot configs yet</p>}
        </div>
      ) : (
        <div className="space-y-2">
          {conversations.map(c => (
            <div key={c.id} className="rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">{c.phone} · {c.message_count} messages</p>
                <p className="text-xs text-gray-500">Started {new Date(c.started_at).toLocaleDateString()}</p>
              </div>
              <div className="flex items-center gap-2">
                {c.status === 'active' && (
                  <button onClick={() => handleTakeover(c.id)} className="px-3 py-1 text-xs bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 rounded-lg hover:opacity-80">
                    <MessageSquare className="w-3 h-3 inline mr-1" /> Takeover
                  </button>
                )}
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${c.status === 'active' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : c.status === 'human_takeover' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30' : 'bg-gray-100 text-gray-500 dark:bg-gray-800'}`}>{c.status}</span>
              </div>
            </div>
          ))}
          {!conversations.length && <p className="text-center py-8 text-gray-500">No conversations yet</p>}
        </div>
      )}

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowCreate(false)}>
          <div className="bg-white dark:bg-gray-900 rounded-xl p-6 w-full max-w-md space-y-4" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold">New AI Bot Config</h2>
            <input className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent text-sm" placeholder="Bot name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
            <input className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent text-sm" placeholder="Greeting message" value={form.greeting_message} onChange={e => setForm({ ...form, greeting_message: e.target.value })} />
            <input className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent text-sm" placeholder="Fallback message" value={form.fallback_message} onChange={e => setForm({ ...form, fallback_message: e.target.value })} />
            <select className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent text-sm" value={form.ai_model} onChange={e => setForm({ ...form, ai_model: e.target.value })}>
              <option value="gpt-4o-mini">GPT-4o Mini</option><option value="gpt-4o">GPT-4o</option><option value="claude-3-haiku">Claude 3 Haiku</option>
            </select>
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
