import { useEffect, useState } from 'react';
import { RefreshCw, Plus, Trash2, Play, Pause, Users } from 'lucide-react';
import { growthApi } from '../../../../packages/ui/src/services/api';
import toast from 'react-hot-toast';

interface Sequence { id: string; name: string; trigger_event: string; steps: unknown[]; is_active: boolean; enrolled_count: number; completed_count: number; created_at: string; }
interface Enrollment { id: string; sequence_id: string; lead_id: string; current_step: number; status: string; started_at: string; }
interface Stats { total_sequences: number; active_sequences: number; active_enrollments: number; completed_enrollments: number; }

export default function FollowupsPage() {
  const [sequences, setSequences] = useState<Sequence[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'sequences' | 'enrollments'>('sequences');
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: '', trigger_event: 'lead_created', steps: [{ channel: 'whatsapp', template: 'Hi {{name}}, thanks for reaching out!', delay_hours: 0 }, { channel: 'sms', template: 'Following up — still interested?', delay_hours: 24 }] });

  async function load() {
    setLoading(true);
    try {
      const [sq, en, st] = await Promise.all([growthApi.followup.listSequences(), growthApi.followup.listEnrollments(), growthApi.followup.getStats()]);
      setSequences(sq.sequences ?? []); setEnrollments(en.enrollments ?? []); setStats(st.stats);
    } finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  async function handleCreate() {
    try { await growthApi.followup.createSequence(form); toast.success('Sequence created'); setShowCreate(false); load(); } catch { toast.error('Failed'); }
  }

  async function handleToggle(id: string) {
    try { await growthApi.followup.toggleSequence(id); toast.success('Toggled'); load(); } catch { toast.error('Failed'); }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete?')) return;
    try { await growthApi.followup.deleteSequence(id); toast.success('Deleted'); load(); } catch { toast.error('Failed'); }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2"><RefreshCw className="w-6 h-6 text-brand-600" /> Smart Follow-Up</h1>
        <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 text-sm"><Plus className="w-4 h-4" /> New Sequence</button>
      </div>

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Sequences', value: stats.total_sequences }, { label: 'Active', value: stats.active_sequences },
            { label: 'Enrollments', value: stats.active_enrollments }, { label: 'Completed', value: stats.completed_enrollments },
          ].map(c => (
            <div key={c.label} className="rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-4">
              <p className="text-sm text-gray-500">{c.label}</p><p className="text-2xl font-bold">{c.value}</p>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-2 border-b border-gray-200 dark:border-gray-800">
        {(['sequences', 'enrollments'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === t ? 'border-brand-600 text-brand-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>{t === 'sequences' ? 'Sequences' : 'Enrollments'}</button>
        ))}
      </div>

      {loading ? <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600" /></div>
      : tab === 'sequences' ? (
        <div className="space-y-3">
          {sequences.map(s => (
            <div key={s.id} className="rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-4 flex items-center justify-between">
              <div>
                <p className="font-medium">{s.name}</p>
                <p className="text-sm text-gray-500">Trigger: {s.trigger_event} · {(s.steps as unknown[]).length} steps · {s.enrolled_count} enrolled · {s.completed_count} completed</p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => handleToggle(s.id)} className={`p-2 rounded-lg ${s.is_active ? 'text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/20' : 'text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/20'}`}>
                  {s.is_active ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                </button>
                <button onClick={() => handleDelete(s.id)} className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"><Trash2 className="w-4 h-4" /></button>
              </div>
            </div>
          ))}
          {!sequences.length && <p className="text-center py-8 text-gray-500">No sequences yet</p>}
        </div>
      ) : (
        <div className="space-y-2">
          {enrollments.map(e => (
            <div key={e.id} className="rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-4 flex items-center justify-between">
              <div>
                <p className="text-sm"><span className="font-mono">{e.lead_id.slice(0, 8)}</span> → Step {e.current_step + 1}</p>
                <p className="text-xs text-gray-500">Started {new Date(e.started_at).toLocaleDateString()}</p>
              </div>
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${e.status === 'active' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-gray-100 text-gray-500 dark:bg-gray-800'}`}>{e.status}</span>
            </div>
          ))}
          {!enrollments.length && <p className="text-center py-8 text-gray-500">No enrollments yet</p>}
        </div>
      )}

      {showCreate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowCreate(false)}>
          <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 w-full max-w-md shadow-xl" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold mb-4">New Follow-Up Sequence</h2>
            <div className="space-y-3">
              <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Sequence name" className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent" />
              <select value={form.trigger_event} onChange={e => setForm({ ...form, trigger_event: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent">
                <option value="lead_created">Lead Created</option><option value="form_submitted">Form Submitted</option><option value="missed_call">Missed Call</option><option value="deal_created">Deal Created</option>
              </select>
              <p className="text-xs text-gray-500">Pre-configured with 2 steps (WhatsApp + SMS follow-up)</p>
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
