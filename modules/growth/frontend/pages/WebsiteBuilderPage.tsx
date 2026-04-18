import { useEffect, useState } from 'react';
import { Globe, Plus, Trash2, Eye, EyeOff, ExternalLink } from 'lucide-react';
import { growthApi } from '../../../../packages/ui/src/services/api';
import toast from 'react-hot-toast';

interface Website { id: string; title: string; slug: string; description: string | null; theme: Record<string, unknown>; sections: unknown[]; is_published: boolean; visit_count: number; created_at: string; }

export default function WebsiteBuilderPage() {
  const [websites, setWebsites] = useState<Website[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({
    title: '', slug: '', description: '',
    theme: { primary_color: '#4F46E5', font: 'Inter' },
    sections: [
      { type: 'hero', content: { heading: 'Welcome', subheading: 'Your business, your way', cta_text: 'Contact Us', cta_url: '#contact' } },
      { type: 'features', content: { items: [{ title: 'Fast', description: 'Lightning quick service' }, { title: 'Reliable', description: 'Always available' }] } },
      { type: 'contact', content: { heading: 'Get in Touch', fields: ['name', 'email', 'phone', 'message'] } },
    ],
  });

  async function load() {
    setLoading(true);
    try {
      const w = await growthApi.websites.list();
      setWebsites(w.websites ?? []);
    } finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  async function handleCreate() {
    try { await growthApi.websites.create(form); toast.success('Website created'); setShowCreate(false); load(); } catch { toast.error('Failed'); }
  }

  async function handlePublish(id: string) {
    try { await growthApi.websites.publish(id); toast.success('Published'); load(); } catch { toast.error('Failed'); }
  }

  async function handleUnpublish(id: string) {
    try { await growthApi.websites.unpublish(id); toast.success('Unpublished'); load(); } catch { toast.error('Failed'); }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete website?')) return;
    try { await growthApi.websites.delete(id); toast.success('Deleted'); load(); } catch { toast.error('Failed'); }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2"><Globe className="w-6 h-6 text-brand-600" /> Mini Website Builder</h1>
        <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 text-sm"><Plus className="w-4 h-4" /> New Website</button>
      </div>

      {loading ? <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600" /></div>
      : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {websites.map(w => (
            <div key={w.id} className="rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 overflow-hidden">
              <div className="h-32 bg-gradient-to-br from-brand-500 to-indigo-600 flex items-center justify-center">
                <Globe className="w-12 h-12 text-white/30" />
              </div>
              <div className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-medium">{w.title}</h3>
                  <span className={`px-2 py-0.5 rounded-full text-xs ${w.is_published ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-gray-100 text-gray-500 dark:bg-gray-800'}`}>
                    {w.is_published ? 'Published' : 'Draft'}
                  </span>
                </div>
                <p className="text-sm text-gray-500 mb-1">/{w.slug}</p>
                {w.description && <p className="text-xs text-gray-400 mb-2">{w.description}</p>}
                <p className="text-xs text-gray-400">{w.visit_count} visits · {w.sections.length} sections</p>
                <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-100 dark:border-gray-800">
                  {w.is_published ? (
                    <button onClick={() => handleUnpublish(w.id)} className="flex items-center gap-1 px-3 py-1.5 text-xs text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded-lg"><EyeOff className="w-3 h-3" /> Unpublish</button>
                  ) : (
                    <button onClick={() => handlePublish(w.id)} className="flex items-center gap-1 px-3 py-1.5 text-xs text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-lg"><Eye className="w-3 h-3" /> Publish</button>
                  )}
                  {w.is_published && (
                    <button onClick={() => window.open(`/api/growth/websites/public/${w.slug}`, '_blank')} className="flex items-center gap-1 px-3 py-1.5 text-xs text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-900/20 rounded-lg"><ExternalLink className="w-3 h-3" /> View</button>
                  )}
                  <button onClick={() => handleDelete(w.id)} className="ml-auto p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"><Trash2 className="w-3 h-3" /></button>
                </div>
              </div>
            </div>
          ))}
          {!websites.length && (
            <div className="col-span-full text-center py-12 text-gray-500">
              <Globe className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p>No websites yet. Create your first mini website!</p>
            </div>
          )}
        </div>
      )}

      {showCreate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowCreate(false)}>
          <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 w-full max-w-md shadow-xl max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold mb-4">New Mini Website</h2>
            <div className="space-y-3">
              <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Website title" className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent" />
              <input value={form.slug} onChange={e => setForm({ ...form, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-') })} placeholder="URL slug (e.g. my-business)" className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent" />
              <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Description (optional)" rows={2} className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent" />
              <p className="text-xs text-gray-500">Pre-configured with Hero + Features + Contact sections</p>
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
