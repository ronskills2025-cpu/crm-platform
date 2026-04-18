import { useState, memo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Image, Plus, Trash2, Edit2, X, Upload, Calendar, Eye,
  Send as SendIcon, FileVideo, FileText,
} from 'lucide-react';
import { instagramApi } from '../../../../packages/ui/src/services/api';
import toast from 'react-hot-toast';

export default memo(function InstagramContentStudio() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [filter, setFilter] = useState({ status: '', contentType: '' });
  const [form, setForm] = useState({
    accountId: '', contentType: 'post', caption: '', hashtags: '',
    mediaUrls: '', thumbnailUrl: '', scheduledAt: '', platforms: 'instagram',
  });

  const { data: accountsData } = useQuery({
    queryKey: ['instagram-accounts'],
    queryFn: () => instagramApi.listAccounts(),
  });
  const accounts = accountsData?.accounts ?? [];

  const { data: contentData, isLoading } = useQuery({
    queryKey: ['instagram-content', filter],
    queryFn: () => instagramApi.listContent(Object.fromEntries(Object.entries(filter).filter(([, v]) => v))),
    refetchInterval: 30_000,
  });
  const content = contentData?.content ?? [];

  const createMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => instagramApi.createContent(data),
    onSuccess: () => { toast.success('Content created'); resetForm(); queryClient.invalidateQueries({ queryKey: ['instagram-content'] }); },
    onError: () => toast.error('Failed to create content'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) => instagramApi.updateContent(id, data),
    onSuccess: () => { toast.success('Content updated'); resetForm(); queryClient.invalidateQueries({ queryKey: ['instagram-content'] }); },
    onError: () => toast.error('Failed to update content'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => instagramApi.deleteContent(id),
    onSuccess: () => { toast.success('Content deleted'); queryClient.invalidateQueries({ queryKey: ['instagram-content'] }); },
  });

  const publishMutation = useMutation({
    mutationFn: (id: string) => instagramApi.publishContent(id),
    onSuccess: () => { toast.success('Content queued for publishing'); queryClient.invalidateQueries({ queryKey: ['instagram-content'] }); },
    onError: () => toast.error('Failed to publish'),
  });

  const resetForm = useCallback(() => {
    setShowForm(false); setEditId(null);
    setForm({ accountId: '', contentType: 'post', caption: '', hashtags: '', mediaUrls: '', thumbnailUrl: '', scheduledAt: '', platforms: 'instagram' });
  }, []);

  const handleEdit = useCallback((item: Record<string, unknown>) => {
    setEditId(item.id as string);
    setForm({
      accountId: item.account_id as string, contentType: item.content_type as string ?? 'post',
      caption: item.caption as string ?? '',
      hashtags: ((item.hashtags as string[]) ?? []).join(', '),
      mediaUrls: ((item.media_urls as string[]) ?? []).join('\n'),
      thumbnailUrl: item.thumbnail_url as string ?? '',
      scheduledAt: item.scheduled_at ? new Date(item.scheduled_at as string).toISOString().slice(0, 16) : '',
      platforms: ((item.platforms as string[]) ?? ['instagram']).join(', '),
    });
    setShowForm(true);
  }, []);

  const handleSubmit = useCallback(() => {
    const payload = {
      accountId: form.accountId, contentType: form.contentType,
      caption: form.caption || undefined,
      hashtags: form.hashtags ? form.hashtags.split(',').map(h => h.trim()).filter(Boolean) : [],
      mediaUrls: form.mediaUrls ? form.mediaUrls.split('\n').map(u => u.trim()).filter(Boolean) : [],
      thumbnailUrl: form.thumbnailUrl || undefined,
      scheduledAt: form.scheduledAt || undefined,
      platforms: form.platforms ? form.platforms.split(',').map(p => p.trim()).filter(Boolean) : ['instagram'],
    };
    if (editId) updateMutation.mutate({ id: editId, data: payload });
    else createMutation.mutate(payload);
  }, [form, editId, createMutation, updateMutation]);

  const typeIcon = (type: string) => {
    switch (type) {
      case 'reel': return <FileVideo className="w-4 h-4" />;
      case 'story': return <Eye className="w-4 h-4" />;
      case 'carousel': return <Image className="w-4 h-4" />;
      default: return <FileText className="w-4 h-4" />;
    }
  };

  const statusColor = (status: string) => {
    switch (status) {
      case 'published': return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400';
      case 'scheduled': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
      case 'failed': return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
      default: return 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-purple-600"><Image className="w-6 h-6 text-white" /></div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Content Studio</h1>
            <p className="text-gray-500 dark:text-gray-400">Create, schedule, and publish content to Instagram</p>
          </div>
        </div>
        <button onClick={() => { resetForm(); setShowForm(true); }}
          className="btn bg-gradient-to-r from-purple-600 to-pink-500 text-white gap-2">
          <Plus className="w-4 h-4" /> New Content
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <select className="input py-2 text-sm" value={filter.status} onChange={(e) => setFilter(f => ({ ...f, status: e.target.value }))}>
          <option value="">All Statuses</option>
          <option value="draft">Draft</option>
          <option value="scheduled">Scheduled</option>
          <option value="published">Published</option>
          <option value="failed">Failed</option>
        </select>
        <select className="input py-2 text-sm" value={filter.contentType} onChange={(e) => setFilter(f => ({ ...f, contentType: e.target.value }))}>
          <option value="">All Types</option>
          <option value="post">Post</option>
          <option value="reel">Reel</option>
          <option value="story">Story</option>
          <option value="carousel">Carousel</option>
        </select>
      </div>

      {/* Content Form */}
      <AnimatePresence>
        {showForm && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
            className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 overflow-hidden">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{editId ? 'Edit Content' : 'Create Content'}</h2>
              <button onClick={resetForm} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"><X className="w-5 h-5" /></button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Account</label>
                <select className="input w-full" value={form.accountId} onChange={(e) => setForm(f => ({ ...f, accountId: e.target.value }))}>
                  <option value="">Select account</option>
                  {accounts.map((a: Record<string, unknown>) => <option key={a.id as string} value={a.id as string}>@{a.ig_username as string}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Content Type</label>
                <select className="input w-full" value={form.contentType} onChange={(e) => setForm(f => ({ ...f, contentType: e.target.value }))}>
                  <option value="post">Post</option>
                  <option value="reel">Reel</option>
                  <option value="story">Story</option>
                  <option value="carousel">Carousel</option>
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Caption</label>
                <textarea className="input w-full h-32 resize-none" value={form.caption} onChange={(e) => setForm(f => ({ ...f, caption: e.target.value }))}
                  placeholder="Write your caption here..." />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Hashtags (comma-separated)</label>
                <input className="input w-full" value={form.hashtags} onChange={(e) => setForm(f => ({ ...f, hashtags: e.target.value }))}
                  placeholder="#marketing, #business, #growth" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Schedule (optional)</label>
                <input type="datetime-local" className="input w-full" value={form.scheduledAt} onChange={(e) => setForm(f => ({ ...f, scheduledAt: e.target.value }))} />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Media URLs (one per line)</label>
                <textarea className="input w-full h-20 resize-none" value={form.mediaUrls} onChange={(e) => setForm(f => ({ ...f, mediaUrls: e.target.value }))}
                  placeholder="https://example.com/image1.jpg&#10;https://example.com/image2.jpg" />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={resetForm} className="btn bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300">Cancel</button>
              <button onClick={handleSubmit} disabled={createMutation.isPending || updateMutation.isPending}
                className="btn bg-gradient-to-r from-purple-600 to-pink-500 text-white disabled:opacity-50">
                {editId ? 'Update' : form.scheduledAt ? 'Schedule' : 'Save Draft'}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Content Grid */}
      {isLoading && <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-pink-500" /></div>}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {content.length === 0 && !isLoading && (
          <div className="md:col-span-2 lg:col-span-3 text-center py-12 text-gray-500 dark:text-gray-400">
            <Image className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>No content yet. Create your first post.</p>
          </div>
        )}
        {content.map((item: Record<string, unknown>) => (
          <motion.div key={item.id as string} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
            className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            {/* Thumbnail */}
            {((item.media_urls as string[]) ?? []).length > 0 ? (
              <div className="h-40 bg-gray-100 dark:bg-gray-700 relative">
                <img src={(item.media_urls as string[])[0]} alt="" className="w-full h-full object-cover" />
                <div className="absolute top-2 left-2 flex items-center gap-1 bg-black/50 px-2 py-1 rounded text-white text-xs">
                  {typeIcon(item.content_type as string)} {item.content_type as string}
                </div>
              </div>
            ) : (
              <div className="h-40 bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
                <div className="text-center text-gray-400">
                  {typeIcon(item.content_type as string)}
                  <p className="text-xs mt-1">{item.content_type as string}</p>
                </div>
              </div>
            )}
            <div className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColor(item.status as string)}`}>
                  {item.status as string}
                </span>
                <div className="flex items-center gap-1">
                  <button onClick={() => handleEdit(item)} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded">
                    <Edit2 className="w-3.5 h-3.5 text-gray-500" />
                  </button>
                  {item.status === 'draft' || item.status === 'scheduled' ? (
                    <button onClick={() => publishMutation.mutate(item.id as string)}
                      className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded" title="Publish now">
                      <SendIcon className="w-3.5 h-3.5 text-purple-500" />
                    </button>
                  ) : null}
                  <button onClick={() => { if (confirm('Delete this content?')) deleteMutation.mutate(item.id as string); }}
                    className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded">
                    <Trash2 className="w-3.5 h-3.5 text-red-500" />
                  </button>
                </div>
              </div>
              <p className="text-sm text-gray-700 dark:text-gray-300 line-clamp-3 mb-2">{item.caption as string}</p>
              {((item.hashtags as string[]) ?? []).length > 0 && (
                <p className="text-xs text-blue-500 dark:text-blue-400 line-clamp-1 mb-2">
                  {((item.hashtags as string[]) ?? []).map((h: string) => `#${h}`).join(' ')}
                </p>
              )}
              <div className="flex items-center gap-3 text-xs text-gray-400">
                {!!item.scheduled_at && (
                  <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {new Date(item.scheduled_at as string).toLocaleDateString()}</span>
                )}
                {!!item.engagement && (
                  <>
                    <span>❤️ {String((item.engagement as Record<string, number>)?.likes ?? 0)}</span>
                    <span>💬 {String((item.engagement as Record<string, number>)?.comments ?? 0)}</span>
                    <span>👁 {String((item.engagement as Record<string, number>)?.reach ?? 0)}</span>
                  </>
                )}
              </div>
              {!!item.error_message && (
                <p className="text-xs text-red-500 mt-2">{String(item.error_message)}</p>
              )}
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
});
