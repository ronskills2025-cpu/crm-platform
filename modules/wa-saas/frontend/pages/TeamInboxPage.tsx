import { useEffect, useState } from 'react';
import { MessageSquare, Plus, Trash2, Send, Users, Clock } from 'lucide-react';
import { waSaasApi } from '../../../../packages/ui/src/services/api';
import { Pagination } from '../../../../packages/ui/src/components/ui/Pagination';
import toast from 'react-hot-toast';

const PAGE_SIZE = 50;

interface Agent { id: string; name: string; email: string; role: string; is_online: boolean; max_concurrent: number; }
interface Conversation { id: string; phone: string; customer_name: string; status: string; priority: string; assigned_agent_id: string; tags: string[]; last_message_at: string; }
interface Stats { total_agents: number; online_agents: number; open_conversations: number; avg_response_time_min: number; resolved_today: number; }

export default function TeamInboxPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'conversations' | 'agents'>('conversations');
  const [showAddAgent, setShowAddAgent] = useState(false);
  const [convoPage, setConvoPage] = useState(0);
  const [convoTotal, setConvoTotal] = useState(0);
  const [agentForm, setAgentForm] = useState({ name: '', email: '', role: 'agent', max_concurrent: 5 });

  async function load() {
    setLoading(true);
    try {
      const [a, c, s] = await Promise.all([waSaasApi.teamInbox.listAgents(), waSaasApi.teamInbox.listConversations({ limit: PAGE_SIZE, offset: convoPage * PAGE_SIZE }), waSaasApi.teamInbox.getStats()]);
      setAgents(a.agents ?? []); setConversations(c.conversations ?? []); setConvoTotal(c.total ?? c.conversations?.length ?? 0); setStats(s.stats);
    } finally { setLoading(false); }
  }

  useEffect(() => { load(); }, [convoPage]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleAddAgent() {
    try { await waSaasApi.teamInbox.createAgent(agentForm); toast.success('Agent added'); setShowAddAgent(false); load(); } catch { toast.error('Failed'); }
  }

  async function handleDeleteAgent(id: string) {
    if (!confirm('Remove agent?')) return;
    try { await waSaasApi.teamInbox.deleteAgent(id); toast.success('Removed'); load(); } catch { toast.error('Failed'); }
  }

  async function handleResolve(id: string) {
    try { await waSaasApi.teamInbox.resolveConversation(id); toast.success('Resolved'); load(); } catch { toast.error('Failed'); }
  }

  const priorityColor = (p: string) => p === 'high' ? 'text-red-500' : p === 'medium' ? 'text-amber-500' : 'text-gray-400';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2"><MessageSquare className="w-6 h-6 text-brand-600" /> Team Inbox</h1>
        <button onClick={() => setShowAddAgent(true)} className="flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 text-sm"><Plus className="w-4 h-4" /> Add Agent</button>
      </div>

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {[{ label: 'Agents', value: stats.total_agents }, { label: 'Online', value: stats.online_agents }, { label: 'Open Chats', value: stats.open_conversations }, { label: 'Avg Response', value: `${stats.avg_response_time_min}m` }, { label: 'Resolved Today', value: stats.resolved_today }].map(c => (
            <div key={c.label} className="rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-4">
              <p className="text-sm text-gray-500">{c.label}</p><p className="text-2xl font-bold">{c.value}</p>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-2 border-b border-gray-200 dark:border-gray-800">
        {(['conversations', 'agents'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === t ? 'border-brand-600 text-brand-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>{t === 'conversations' ? 'Conversations' : 'Agents'}</button>
        ))}
      </div>

      {loading ? <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600" /></div>
      : tab === 'conversations' ? (
        <div className="space-y-2">
          {conversations.map(c => (
            <div key={c.id} className="rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-2 h-2 rounded-full ${priorityColor(c.priority)} bg-current`} />
                <div>
                  <p className="font-medium">{c.customer_name || c.phone}</p>
                  <p className="text-xs text-gray-500">{c.phone} · {c.tags?.length ? c.tags.join(', ') : 'No tags'} · {new Date(c.last_message_at).toLocaleString()}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {c.status === 'open' && <button onClick={() => handleResolve(c.id)} className="px-3 py-1 text-xs bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 rounded-lg">Resolve</button>}
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${c.status === 'open' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30' : c.status === 'resolved' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-gray-100 text-gray-500 dark:bg-gray-800'}`}>{c.status}</span>
              </div>
            </div>
          ))}
          {!conversations.length && <p className="text-center py-8 text-gray-500">No conversations yet</p>}
          <Pagination page={convoPage} pageSize={PAGE_SIZE} total={convoTotal} onPageChange={setConvoPage} />
        </div>
      ) : (
        <div className="space-y-3">
          {agents.map(a => (
            <div key={a.id} className="rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-3 h-3 rounded-full ${a.is_online ? 'bg-emerald-500' : 'bg-gray-400'}`} />
                <div>
                  <p className="font-medium">{a.name}</p>
                  <p className="text-sm text-gray-500">{a.email} · {a.role} · Max {a.max_concurrent} chats</p>
                </div>
              </div>
              <button onClick={() => handleDeleteAgent(a.id)} className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"><Trash2 className="w-4 h-4" /></button>
            </div>
          ))}
          {!agents.length && <p className="text-center py-8 text-gray-500">No agents yet</p>}
        </div>
      )}

      {showAddAgent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowAddAgent(false)}>
          <div className="bg-white dark:bg-gray-900 rounded-xl p-6 w-full max-w-md space-y-4" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold">Add Agent</h2>
            <input className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent text-sm" placeholder="Name" value={agentForm.name} onChange={e => setAgentForm({ ...agentForm, name: e.target.value })} />
            <input className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent text-sm" placeholder="Email" value={agentForm.email} onChange={e => setAgentForm({ ...agentForm, email: e.target.value })} />
            <select className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent text-sm" value={agentForm.role} onChange={e => setAgentForm({ ...agentForm, role: e.target.value })}>
              <option value="agent">Agent</option><option value="supervisor">Supervisor</option><option value="admin">Admin</option>
            </select>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowAddAgent(false)} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700">Cancel</button>
              <button onClick={handleAddAgent} className="px-4 py-2 text-sm bg-brand-600 text-white rounded-lg hover:bg-brand-700">Add</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
