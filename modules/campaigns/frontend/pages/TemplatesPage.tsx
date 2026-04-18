import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, Upload, X, Eye } from 'lucide-react';
import { templateApi } from '../../../../packages/ui/src/services/api';

interface WabaTemplate {
  id: string;
  name: string;
  language: string;
  category: string;
  status: string;
  components: unknown[];
  createdAt: string;
}

const CATEGORIES = ['MARKETING', 'UTILITY', 'AUTHENTICATION'];
const LANGUAGES = ['en', 'en_US', 'hi', 'ta', 'te', 'bn', 'mr', 'gu', 'kn', 'ml'];

function statusColour(status: string) {
  const map: Record<string, string> = {
    PENDING:  'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    APPROVED: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
    REJECTED: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    DRAFT:    'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  };
  return map[status] ?? map.DRAFT;
}

// ─── Template Form ───────────────────────────────────────────────────────────
interface FormProps {
  initial?: Partial<WabaTemplate>;
  onSave: (data: Record<string, unknown>) => Promise<void>;
  onCancel: () => void;
}

function TemplateForm({ initial, onSave, onCancel }: FormProps) {
  const [name, setName] = useState(initial?.name ?? '');
  const [language, setLanguage] = useState(initial?.language ?? 'en');
  const [category, setCategory] = useState(initial?.category ?? 'MARKETING');
  const [bodyText, setBodyText] = useState(() => {
    if (!initial?.components) return '';
    const body = (initial.components as Array<{ type: string; text?: string }>).find((c) => c.type === 'BODY');
    return body?.text ?? '';
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function submit() {
    setSaving(true);
    setError('');
    try {
      await onSave({
        name, language, category,
        components: [{ type: 'BODY', text: bodyText }],
      });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            {initial?.id ? 'Edit Template' : 'New Template'}
          </h2>
          <button onClick={onCancel}><X className="w-5 h-5 text-gray-400" /></button>
        </div>

        {error && (
          <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-3 py-2 text-sm text-red-700 dark:text-red-400">
            {error}
          </div>
        )}

        <div className="space-y-1">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Template Name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="order_confirmation"
            className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
          <p className="text-xs text-gray-400">Lowercase, underscores only. E.g. cart_abandoned_v1</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Language</label>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              {LANGUAGES.map((l) => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>

        <div className="space-y-1">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Body text</label>
          <textarea
            rows={5}
            value={bodyText}
            onChange={(e) => setBodyText(e.target.value)}
            placeholder="Hi {{1}}, you left items in your cart: {{2}}. Complete your order: {{3}}"
            className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
          />
          <p className="text-xs text-gray-400">Use {'{{1}}'}, {'{{2}}'} for variables</p>
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <button onClick={onCancel} className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors">
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={saving || !name || !bodyText}
            className="px-4 py-2 text-sm font-semibold bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white rounded-lg transition-colors"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Submit to Meta modal ─────────────────────────────────────────────────────
function SubmitModal({ templateId, onClose }: { templateId: string; onClose: () => void }) {
  const [accessToken, setAccessToken] = useState('');
  const [wabaId, setWabaId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  async function submit() {
    setLoading(true);
    setError('');
    try {
      await templateApi.submitToMeta(templateId, { accessToken, wabaId });
      setDone(true);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Submit failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Submit to Meta</h2>
          <button onClick={onClose}><X className="w-5 h-5 text-gray-400" /></button>
        </div>

        {done ? (
          <div className="text-center py-4 space-y-2">
            <p className="text-emerald-600 dark:text-emerald-400 font-semibold">Submitted successfully!</p>
            <p className="text-sm text-gray-400">Meta will review your template. Status will update soon.</p>
            <button onClick={onClose} className="mt-2 px-4 py-2 text-sm bg-brand-600 hover:bg-brand-700 text-white rounded-lg">Close</button>
          </div>
        ) : (
          <>
            {error && (
              <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-3 py-2 text-sm text-red-700 dark:text-red-400">
                {error}
              </div>
            )}
            {[
              { label: 'WhatsApp Business Account ID', value: wabaId, setter: setWabaId, ph: '123456789' },
              { label: 'Access Token', value: accessToken, setter: setAccessToken, ph: 'EAABxxxxxx…' },
            ].map(({ label, value, setter, ph }) => (
              <div key={label} className="space-y-1">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">{label}</label>
                <input
                  value={value}
                  onChange={(e) => setter(e.target.value)}
                  placeholder={ph}
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
            ))}
            <div className="flex justify-end gap-2">
              <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg">Cancel</button>
              <button
                onClick={submit}
                disabled={loading || !accessToken || !wabaId}
                className="px-4 py-2 text-sm font-semibold bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white rounded-lg"
              >
                {loading ? 'Submitting…' : 'Submit'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────
export default function TemplatesPage() {
  const [templates, setTemplates] = useState<WabaTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<WabaTemplate | null>(null);
  const [submitFor, setSubmitFor] = useState<string | null>(null);
  const [preview, setPreview] = useState<WabaTemplate | null>(null);

  async function load() {
    setLoading(true);
    try {
      const d = await templateApi.list();
      setTemplates(d.templates ?? []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function handleCreate(data: Record<string, unknown>) {
    await templateApi.create(data);
    setFormOpen(false);
    load();
  }

  async function handleUpdate(data: Record<string, unknown>) {
    if (!editing) return;
    await templateApi.update(editing.id, data);
    setEditing(null);
    load();
  }

  async function handleDelete(id: string) {
    if (!window.confirm('Delete this template?')) return;
    await templateApi.delete(id);
    load();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">WABA Templates</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">WhatsApp Business message templates</p>
        </div>
        <button
          onClick={() => setFormOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Template
        </button>
      </div>

      <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-sm text-gray-400">Loading…</div>
        ) : templates.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-400">No templates yet.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-800">
                {['Name', 'Language', 'Category', 'Status', 'Created', ''].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {templates.map((t) => (
                <tr key={t.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                  <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">{t.name}</td>
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{t.language}</td>
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400 capitalize">{t.category.toLowerCase()}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${statusColour(t.status)}`}>
                      {t.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400">
                    {new Date(t.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setPreview(t)}
                        className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                        title="Preview"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setEditing(t)}
                        className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                        title="Edit"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setSubmitFor(t.id)}
                        className="p-1.5 rounded-lg hover:bg-emerald-50 dark:hover:bg-emerald-900/20 text-gray-400 hover:text-emerald-600 dark:hover:text-emerald-400"
                        title="Submit to Meta"
                      >
                        <Upload className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(t.id)}
                        className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-400 hover:text-red-600 dark:hover:text-red-400"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Preview modal */}
      {preview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-gray-900 dark:text-gray-100">{preview.name}</h2>
              <button onClick={() => setPreview(null)}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            {/* WhatsApp bubble mock */}
            <div className="bg-[#dcf8c6] dark:bg-emerald-900/30 rounded-xl p-3 text-sm text-gray-800 dark:text-gray-200 max-w-[80%]">
              {(preview.components as Array<{ type: string; text?: string }>).find((c) => c.type === 'BODY')?.text ?? 'No body text'}
            </div>
            <div className="flex gap-2 text-xs text-gray-400">
              <span>{preview.language}</span>
              <span>·</span>
              <span>{preview.category}</span>
              <span>·</span>
              <span className={`px-1.5 py-0.5 rounded-md font-medium ${statusColour(preview.status)}`}>{preview.status}</span>
            </div>
          </div>
        </div>
      )}

      {formOpen && <TemplateForm onSave={handleCreate} onCancel={() => setFormOpen(false)} />}
      {editing && <TemplateForm initial={editing} onSave={handleUpdate} onCancel={() => setEditing(null)} />}
      {submitFor && <SubmitModal templateId={submitFor} onClose={() => { setSubmitFor(null); load(); }} />}
    </div>
  );
}
