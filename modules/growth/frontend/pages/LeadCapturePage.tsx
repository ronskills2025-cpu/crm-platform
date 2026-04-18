import { useEffect, useState } from 'react';
import { Target, Plus, Trash2, Eye, Copy, BarChart3 } from 'lucide-react';
import { growthApi } from '../../../../packages/ui/src/services/api';
import toast from 'react-hot-toast';

interface Form { id: string; name: string; form_type: string; fields: unknown[]; redirect_url: string | null; is_active: boolean; submission_count: number; created_at: string; }
interface Submission { id: string; form_id: string; data: Record<string, unknown>; source_url: string | null; created_at: string; }
interface Stats { total_forms: number; total_submissions: number; active_forms: number; today_submissions: number; }

export default function LeadCapturePage() {
  const [forms, setForms] = useState<Form[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'forms' | 'submissions'>('forms');
  const [showCreate, setShowCreate] = useState(false);
  const [newForm, setNewForm] = useState({ name: '', form_type: 'contact', fields: [{ name: 'name', type: 'text', required: true }, { name: 'email', type: 'email', required: true }, { name: 'phone', type: 'tel', required: false }] });

  async function load() {
    setLoading(true);
    try {
      const [f, s, st] = await Promise.all([growthApi.leadCapture.listForms(), growthApi.leadCapture.listSubmissions(), growthApi.leadCapture.getStats()]);
      setForms(f.forms ?? []); setSubmissions(s.submissions ?? []); setStats(st.stats);
    } finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  async function handleCreate() {
    try { await growthApi.leadCapture.createForm(newForm); toast.success('Form created'); setShowCreate(false); load(); } catch { toast.error('Failed'); }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this form?')) return;
    try { await growthApi.leadCapture.deleteForm(id); toast.success('Deleted'); load(); } catch { toast.error('Failed'); }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2"><Target className="w-6 h-6 text-brand-600" /> Lead Capture</h1>
        <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 text-sm"><Plus className="w-4 h-4" /> New Form</button>
      </div>

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Total Forms', value: stats.total_forms, icon: Target },
            { label: 'Active Forms', value: stats.active_forms, icon: Eye },
            { label: 'Total Submissions', value: stats.total_submissions, icon: BarChart3 },
            { label: 'Today', value: stats.today_submissions, icon: Copy },
          ].map(c => (
            <div key={c.label} className="rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-4">
              <div className="flex items-center gap-2 text-sm text-gray-500 mb-1"><c.icon className="w-4 h-4" /> {c.label}</div>
              <p className="text-2xl font-bold">{c.value}</p>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-2 border-b border-gray-200 dark:border-gray-800">
        {(['forms', 'submissions'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === t ? 'border-brand-600 text-brand-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>{t === 'forms' ? 'Forms' : 'Submissions'}</button>
        ))}
      </div>

      {loading ? <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600" /></div>
      : tab === 'forms' ? (
        <div className="space-y-3">
          {forms.map(f => (
            <div key={f.id} className="rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-4 flex items-center justify-between">
              <div>
                <p className="font-medium">{f.name}</p>
                <p className="text-sm text-gray-500">{f.form_type} · {f.submission_count} submissions · {f.is_active ? '🟢 Active' : '🔴 Inactive'}</p>
              </div>
              <button onClick={() => handleDelete(f.id)} className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"><Trash2 className="w-4 h-4" /></button>
            </div>
          ))}
          {!forms.length && <p className="text-center py-8 text-gray-500">No forms yet</p>}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-gray-200 dark:border-gray-800 text-left text-gray-500"><th className="py-2 px-3">Form</th><th className="py-2 px-3">Data</th><th className="py-2 px-3">Source</th><th className="py-2 px-3">Date</th></tr></thead>
            <tbody>
              {submissions.map(s => (
                <tr key={s.id} className="border-b border-gray-100 dark:border-gray-800/50">
                  <td className="py-2 px-3 font-mono text-xs">{s.form_id.slice(0, 8)}</td>
                  <td className="py-2 px-3 text-xs">{JSON.stringify(s.data).slice(0, 60)}</td>
                  <td className="py-2 px-3 text-xs">{s.source_url ?? '—'}</td>
                  <td className="py-2 px-3 text-xs text-gray-500">{new Date(s.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!submissions.length && <p className="text-center py-8 text-gray-500">No submissions yet</p>}
        </div>
      )}

      {showCreate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowCreate(false)}>
          <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 w-full max-w-md shadow-xl" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold mb-4">New Lead Capture Form</h2>
            <div className="space-y-3">
              <input value={newForm.name} onChange={e => setNewForm({ ...newForm, name: e.target.value })} placeholder="Form name" className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent" />
              <select value={newForm.form_type} onChange={e => setNewForm({ ...newForm, form_type: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent">
                <option value="contact">Contact</option><option value="newsletter">Newsletter</option><option value="quote">Quote Request</option><option value="callback">Callback</option>
              </select>
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
