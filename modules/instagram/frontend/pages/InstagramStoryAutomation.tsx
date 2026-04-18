import { useState, memo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BookOpen, Plus, Trash2, Edit2, X, ToggleLeft, ToggleRight, Zap,
} from 'lucide-react';
import { instagramApi } from '../../../../packages/ui/src/services/api';
import toast from 'react-hot-toast';

export default memo(function InstagramStoryAutomation() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({
    accountId: '', name: '', triggerType: 'story_reply',
    keywords: '', matchType: 'any', dmTemplate: '', dmTemplateB: '',
    abSplit: 100, delayMinSec: 0, delayMaxSec: 0,
    followupTemplate: '', followupDelaySec: 0, autoTag: '',
  });

  const { data: accountsData } = useQuery({
    queryKey: ['instagram-accounts'],
    queryFn: () => instagramApi.listAccounts(),
  });
  const accounts = accountsData?.accounts ?? [];

  const { data: rulesData, isLoading } = useQuery({
    queryKey: ['instagram-story-rules'],
    queryFn: () => instagramApi.listStoryRules(),
    refetchInterval: 30_000,
  });
  const rules = rulesData?.rules ?? [];

  const createMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => instagramApi.createStoryRule(data),
    onSuccess: () => { toast.success('Rule created'); resetForm(); queryClient.invalidateQueries({ queryKey: ['instagram-story-rules'] }); },
    onError: () => toast.error('Failed to create rule'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) => instagramApi.updateStoryRule(id, data),
    onSuccess: () => { toast.success('Rule updated'); resetForm(); queryClient.invalidateQueries({ queryKey: ['instagram-story-rules'] }); },
    onError: () => toast.error('Failed to update rule'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => instagramApi.deleteStoryRule(id),
    onSuccess: () => { toast.success('Rule deleted'); queryClient.invalidateQueries({ queryKey: ['instagram-story-rules'] }); },
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      instagramApi.updateStoryRule(id, { isActive: !isActive }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['instagram-story-rules'] }),
  });

  const resetForm = useCallback(() => {
    setShowForm(false); setEditId(null);
    setForm({ accountId: '', name: '', triggerType: 'story_reply', keywords: '', matchType: 'any', dmTemplate: '', dmTemplateB: '', abSplit: 100, delayMinSec: 0, delayMaxSec: 0, followupTemplate: '', followupDelaySec: 0, autoTag: '' });
  }, []);

  const handleEdit = useCallback((rule: Record<string, unknown>) => {
    setEditId(rule.id as string);
    setForm({
      accountId: rule.account_id as string, name: rule.name as string,
      triggerType: rule.trigger_type as string ?? 'story_reply',
      keywords: ((rule.keywords as string[]) ?? []).join(', '),
      matchType: rule.match_type as string ?? 'any',
      dmTemplate: rule.dm_template as string ?? '',
      dmTemplateB: rule.dm_template_b as string ?? '',
      abSplit: rule.ab_split as number ?? 100,
      delayMinSec: rule.delay_min_sec as number ?? 0,
      delayMaxSec: rule.delay_max_sec as number ?? 0,
      followupTemplate: rule.followup_template as string ?? '',
      followupDelaySec: rule.followup_delay_sec as number ?? 0,
      autoTag: ((rule.auto_tag as string[]) ?? []).join(', '),
    });
    setShowForm(true);
  }, []);

  const handleSubmit = useCallback(() => {
    const payload = {
      accountId: form.accountId, name: form.name, triggerType: form.triggerType,
      keywords: form.keywords ? form.keywords.split(',').map(k => k.trim()).filter(Boolean) : [],
      matchType: form.matchType, dmTemplate: form.dmTemplate,
      dmTemplateB: form.dmTemplateB || undefined,
      abSplit: form.abSplit, delayMinSec: form.delayMinSec, delayMaxSec: form.delayMaxSec,
      followupTemplate: form.followupTemplate || undefined,
      followupDelaySec: form.followupDelaySec,
      autoTag: form.autoTag ? form.autoTag.split(',').map(t => t.trim()).filter(Boolean) : [],
    };
    if (editId) updateMutation.mutate({ id: editId, data: payload });
    else createMutation.mutate(payload);
  }, [form, editId, createMutation, updateMutation]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-orange-600"><BookOpen className="w-6 h-6 text-white" /></div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Story Reply Automation</h1>
            <p className="text-gray-500 dark:text-gray-400">Auto-DM when users reply to or mention your stories</p>
          </div>
        </div>
        <button onClick={() => { resetForm(); setShowForm(true); }}
          className="btn bg-gradient-to-r from-purple-600 to-pink-500 text-white gap-2">
          <Plus className="w-4 h-4" /> New Rule
        </button>
      </div>

      <AnimatePresence>
        {showForm && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
            className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 overflow-hidden">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{editId ? 'Edit Rule' : 'Create Rule'}</h2>
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
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Rule Name</label>
                <input className="input w-full" value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Poll Reply Thank You" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Trigger Type</label>
                <select className="input w-full" value={form.triggerType} onChange={(e) => setForm(f => ({ ...f, triggerType: e.target.value }))}>
                  <option value="story_reply">Story Reply</option>
                  <option value="story_mention">Story Mention</option>
                  <option value="poll_vote">Poll Vote</option>
                  <option value="question_response">Question Response</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Keywords (optional, comma-separated)</label>
                <input className="input w-full" value={form.keywords} onChange={(e) => setForm(f => ({ ...f, keywords: e.target.value }))} placeholder="Leave empty for all replies" />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">DM Template (A)</label>
                <textarea className="input w-full h-24 resize-none" value={form.dmTemplate} onChange={(e) => setForm(f => ({ ...f, dmTemplate: e.target.value }))}
                  placeholder="Hey {{username}}! Thanks for engaging with our story!" />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">DM Template B (A/B test, optional)</label>
                <textarea className="input w-full h-20 resize-none" value={form.dmTemplateB} onChange={(e) => setForm(f => ({ ...f, dmTemplateB: e.target.value }))} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Follow-up Message (optional)</label>
                <textarea className="input w-full h-20 resize-none" value={form.followupTemplate} onChange={(e) => setForm(f => ({ ...f, followupTemplate: e.target.value }))}
                  placeholder="Sending follow-up after delay..." />
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Follow-up Delay (sec)</label>
                  <input type="number" className="input w-full" min={0} value={form.followupDelaySec} onChange={(e) => setForm(f => ({ ...f, followupDelaySec: parseInt(e.target.value) || 0 }))} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">A/B Split (%)</label>
                  <input type="number" className="input w-full" min={0} max={100} value={form.abSplit} onChange={(e) => setForm(f => ({ ...f, abSplit: parseInt(e.target.value) || 100 }))} />
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={resetForm} className="btn bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300">Cancel</button>
              <button onClick={handleSubmit} disabled={createMutation.isPending || updateMutation.isPending}
                className="btn bg-gradient-to-r from-purple-600 to-pink-500 text-white disabled:opacity-50">
                {editId ? 'Update Rule' : 'Create Rule'}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {isLoading && <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-pink-500" /></div>}
      <div className="space-y-4">
        {rules.length === 0 && !isLoading && (
          <div className="text-center py-12 text-gray-500 dark:text-gray-400">
            <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>No story automation rules. Create one to get started.</p>
          </div>
        )}
        {rules.map((rule: Record<string, unknown>) => (
          <motion.div key={rule.id as string} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <h3 className="font-semibold text-gray-900 dark:text-white">{rule.name as string}</h3>
                <span className="px-2 py-0.5 bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 rounded-full text-xs font-medium">
                  {(rule.trigger_type as string)?.replace(/_/g, ' ')}
                </span>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                  rule.is_active ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                    : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'
                }`}>
                  {rule.is_active ? 'Active' : 'Paused'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => toggleMutation.mutate({ id: rule.id as string, isActive: rule.is_active as boolean })}
                  className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded">
                  {rule.is_active ? <ToggleRight className="w-5 h-5 text-emerald-500" /> : <ToggleLeft className="w-5 h-5 text-gray-400" />}
                </button>
                <button onClick={() => handleEdit(rule)} className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded">
                  <Edit2 className="w-4 h-4 text-gray-500" />
                </button>
                <button onClick={() => { if (confirm('Delete this rule?')) deleteMutation.mutate(rule.id as string); }}
                  className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded">
                  <Trash2 className="w-4 h-4 text-red-500" />
                </button>
              </div>
            </div>
            {((rule.keywords as string[]) ?? []).length > 0 && (
              <div className="flex flex-wrap gap-1 mb-2">
                {((rule.keywords as string[]) ?? []).map((k: string, i: number) => (
                  <span key={i} className="px-2 py-0.5 bg-orange-100 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300 rounded text-xs">{k}</span>
                ))}
              </div>
            )}
            <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2 mb-2">{String(rule.dm_template)}</p>
            <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
              {!!rule.followup_template && <span className="flex items-center gap-1"><Zap className="w-3 h-3" /> Follow-up in {String(rule.followup_delay_sec)}s</span>}
              {!!rule.dm_template_b && <span>🔀 A/B {String(rule.ab_split)}%</span>}
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
});
