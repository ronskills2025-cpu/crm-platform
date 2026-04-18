import { useState, memo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bot, Plus, Trash2, Edit2, X, ToggleLeft, ToggleRight, Users,
  TrendingUp, AlertTriangle,
} from 'lucide-react';
import { instagramApi } from '../../../../packages/ui/src/services/api';
import toast from 'react-hot-toast';

interface StepForm { question: string; field: string; type: string; options: string; score: number; }

export default memo(function InstagramLeadBot() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<'configs' | 'leads'>('configs');
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({
    accountId: '', name: '', welcomeMessage: 'Hi! Let me help you get started.',
    completionMessage: '', sendToWhatsapp: false, whatsappNumber: '',
    googleSheetId: '', googleSheetTab: '', recoveryMessage: '', recoveryDelayHours: 24,
  });
  const [steps, setSteps] = useState<StepForm[]>([
    { question: '', field: '', type: 'text', options: '', score: 0 },
  ]);
  const [leadFilter, setLeadFilter] = useState({ status: '', segment: '' });

  const { data: accountsData } = useQuery({
    queryKey: ['instagram-accounts'],
    queryFn: () => instagramApi.listAccounts(),
  });
  const accounts = accountsData?.accounts ?? [];

  const { data: configsData, isLoading: loadingConfigs } = useQuery({
    queryKey: ['instagram-lead-bot-configs'],
    queryFn: () => instagramApi.listLeadBotConfigs(),
    enabled: tab === 'configs',
  });
  const configs = configsData?.configs ?? [];

  const { data: leadsData, isLoading: loadingLeads } = useQuery({
    queryKey: ['instagram-leads', leadFilter],
    queryFn: () => instagramApi.listLeads(Object.fromEntries(Object.entries(leadFilter).filter(([, v]) => v))),
    enabled: tab === 'leads',
    refetchInterval: 30_000,
  });
  const leads = leadsData?.leads ?? [];

  const createMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => instagramApi.createLeadBotConfig(data),
    onSuccess: () => { toast.success('Config created'); resetForm(); queryClient.invalidateQueries({ queryKey: ['instagram-lead-bot-configs'] }); },
    onError: () => toast.error('Failed to create config'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) => instagramApi.updateLeadBotConfig(id, data),
    onSuccess: () => { toast.success('Config updated'); resetForm(); queryClient.invalidateQueries({ queryKey: ['instagram-lead-bot-configs'] }); },
    onError: () => toast.error('Failed to update config'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => instagramApi.deleteLeadBotConfig(id),
    onSuccess: () => { toast.success('Config deleted'); queryClient.invalidateQueries({ queryKey: ['instagram-lead-bot-configs'] }); },
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      instagramApi.updateLeadBotConfig(id, { isActive: !isActive }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['instagram-lead-bot-configs'] }),
  });

  const resetForm = useCallback(() => {
    setShowForm(false); setEditId(null);
    setForm({ accountId: '', name: '', welcomeMessage: 'Hi! Let me help you get started.', completionMessage: '', sendToWhatsapp: false, whatsappNumber: '', googleSheetId: '', googleSheetTab: '', recoveryMessage: '', recoveryDelayHours: 24 });
    setSteps([{ question: '', field: '', type: 'text', options: '', score: 0 }]);
  }, []);

  const handleEdit = useCallback((cfg: Record<string, unknown>) => {
    setEditId(cfg.id as string);
    setForm({
      accountId: cfg.account_id as string, name: cfg.name as string,
      welcomeMessage: cfg.welcome_message as string ?? '',
      completionMessage: cfg.completion_message as string ?? '',
      sendToWhatsapp: cfg.send_to_whatsapp as boolean ?? false,
      whatsappNumber: cfg.whatsapp_number as string ?? '',
      googleSheetId: cfg.google_sheet_id as string ?? '',
      googleSheetTab: cfg.google_sheet_tab as string ?? '',
      recoveryMessage: cfg.recovery_message as string ?? '',
      recoveryDelayHours: cfg.recovery_delay_hours as number ?? 24,
    });
    const rawSteps = (cfg.steps as Array<Record<string, unknown>>) ?? [];
    setSteps(rawSteps.map(s => ({
      question: s.question as string ?? '', field: s.field as string ?? '',
      type: s.type as string ?? 'text',
      options: ((s.options as string[]) ?? []).join(', '),
      score: s.score as number ?? 0,
    })));
    setShowForm(true);
  }, []);

  const handleSubmit = useCallback(() => {
    const payload = {
      accountId: form.accountId, name: form.name,
      welcomeMessage: form.welcomeMessage, completionMessage: form.completionMessage || undefined,
      sendToWhatsapp: form.sendToWhatsapp, whatsappNumber: form.whatsappNumber || undefined,
      googleSheetId: form.googleSheetId || undefined, googleSheetTab: form.googleSheetTab || undefined,
      recoveryMessage: form.recoveryMessage || undefined, recoveryDelayHours: form.recoveryDelayHours,
      steps: steps.map(s => ({
        question: s.question, field: s.field, type: s.type,
        options: s.options ? s.options.split(',').map(o => o.trim()).filter(Boolean) : undefined,
        score: s.score,
      })),
    };
    if (editId) updateMutation.mutate({ id: editId, data: payload });
    else createMutation.mutate(payload);
  }, [form, steps, editId, createMutation, updateMutation]);

  const addStep = useCallback(() => setSteps(s => [...s, { question: '', field: '', type: 'text', options: '', score: 0 }]), []);
  const removeStep = useCallback((i: number) => setSteps(s => s.filter((_, idx) => idx !== i)), []);
  const updateStep = useCallback((i: number, key: keyof StepForm, value: string | number) => {
    setSteps(s => s.map((step, idx) => idx === i ? { ...step, [key]: value } : step));
  }, []);

  const segmentColor = (seg: string) => {
    switch (seg) { case 'hot': return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'; case 'warm': return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'; case 'cold': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'; default: return 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'; }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-emerald-600"><Bot className="w-6 h-6 text-white" /></div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Lead Qualification Bot</h1>
            <p className="text-gray-500 dark:text-gray-400">Multi-step conversation bot for qualifying Instagram leads</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {tab === 'configs' && (
            <button onClick={() => { resetForm(); setShowForm(true); }}
              className="btn bg-gradient-to-r from-purple-600 to-pink-500 text-white gap-2">
              <Plus className="w-4 h-4" /> New Bot
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-lg w-fit">
        <button onClick={() => setTab('configs')} className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${tab === 'configs' ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}>
          Bot Configs
        </button>
        <button onClick={() => setTab('leads')} className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${tab === 'leads' ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}>
          Leads
        </button>
      </div>

      {/* Config Form */}
      <AnimatePresence>
        {showForm && tab === 'configs' && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
            className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 overflow-hidden">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{editId ? 'Edit Bot' : 'New Bot Config'}</h2>
              <button onClick={resetForm} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"><X className="w-5 h-5" /></button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Account</label>
                <select className="input w-full" value={form.accountId} onChange={(e) => setForm(f => ({ ...f, accountId: e.target.value }))}>
                  <option value="">Select account</option>
                  {accounts.map((a: Record<string, unknown>) => <option key={a.id as string} value={a.id as string}>@{a.ig_username as string}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Bot Name</label>
                <input className="input w-full" value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Product Interest Bot" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Welcome Message</label>
                <input className="input w-full" value={form.welcomeMessage} onChange={(e) => setForm(f => ({ ...f, welcomeMessage: e.target.value }))} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Completion Message</label>
                <input className="input w-full" value={form.completionMessage} onChange={(e) => setForm(f => ({ ...f, completionMessage: e.target.value }))} placeholder="Thanks for your answers!" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Recovery Message</label>
                <input className="input w-full" value={form.recoveryMessage} onChange={(e) => setForm(f => ({ ...f, recoveryMessage: e.target.value }))} placeholder="Hey {{username}}, you didn't finish..." />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Recovery Delay (hours)</label>
                <input type="number" className="input w-full" value={form.recoveryDelayHours} onChange={(e) => setForm(f => ({ ...f, recoveryDelayHours: parseInt(e.target.value) || 24 }))} />
              </div>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={form.sendToWhatsapp} onChange={(e) => setForm(f => ({ ...f, sendToWhatsapp: e.target.checked }))} />
                  <span className="text-sm text-gray-700 dark:text-gray-300">Send to WhatsApp</span>
                </label>
              </div>
              {form.sendToWhatsapp && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">WhatsApp Number</label>
                  <input className="input w-full" value={form.whatsappNumber} onChange={(e) => setForm(f => ({ ...f, whatsappNumber: e.target.value }))} placeholder="+1234567890" />
                </div>
              )}
            </div>

            {/* Steps */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-medium text-gray-900 dark:text-white">Conversation Steps</h3>
                <button onClick={addStep} className="text-sm text-purple-600 dark:text-purple-400 hover:underline flex items-center gap-1">
                  <Plus className="w-3 h-3" /> Add Step
                </button>
              </div>
              <div className="space-y-3">
                {steps.map((step, i) => (
                  <div key={i} className="flex gap-3 items-start p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                    <span className="text-sm font-bold text-gray-400 mt-2">{i + 1}</span>
                    <div className="flex-1 grid grid-cols-1 md:grid-cols-4 gap-2">
                      <input className="input col-span-2" placeholder="Question" value={step.question} onChange={(e) => updateStep(i, 'question', e.target.value)} />
                      <input className="input" placeholder="Field name" value={step.field} onChange={(e) => updateStep(i, 'field', e.target.value)} />
                      <select className="input" value={step.type} onChange={(e) => updateStep(i, 'type', e.target.value)}>
                        <option value="text">Text</option>
                        <option value="choice">Multiple Choice</option>
                        <option value="number">Number</option>
                        <option value="email">Email</option>
                        <option value="phone">Phone</option>
                      </select>
                      {step.type === 'choice' && (
                        <input className="input col-span-2" placeholder="Options (comma-separated)" value={step.options} onChange={(e) => updateStep(i, 'options', e.target.value)} />
                      )}
                      <input type="number" className="input" placeholder="Score" value={step.score} onChange={(e) => updateStep(i, 'score', parseInt(e.target.value) || 0)} />
                    </div>
                    {steps.length > 1 && (
                      <button onClick={() => removeStep(i)} className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded mt-1">
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <button onClick={resetForm} className="btn bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300">Cancel</button>
              <button onClick={handleSubmit} disabled={createMutation.isPending || updateMutation.isPending}
                className="btn bg-gradient-to-r from-purple-600 to-pink-500 text-white disabled:opacity-50">
                {editId ? 'Update Bot' : 'Create Bot'}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Configs Tab */}
      {tab === 'configs' && (
        <>
          {loadingConfigs && <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-pink-500" /></div>}
          <div className="space-y-4">
            {configs.length === 0 && !loadingConfigs && (
              <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                <Bot className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>No lead bot configurations. Create one to start qualifying leads.</p>
              </div>
            )}
            {configs.map((cfg: Record<string, unknown>) => (
              <motion.div key={cfg.id as string} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <h3 className="font-semibold text-gray-900 dark:text-white">{cfg.name as string}</h3>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      cfg.is_active ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                        : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'
                    }`}>
                      {cfg.is_active ? 'Active' : 'Paused'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => toggleMutation.mutate({ id: cfg.id as string, isActive: cfg.is_active as boolean })}
                      className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded">
                      {cfg.is_active ? <ToggleRight className="w-5 h-5 text-emerald-500" /> : <ToggleLeft className="w-5 h-5 text-gray-400" />}
                    </button>
                    <button onClick={() => handleEdit(cfg)} className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded">
                      <Edit2 className="w-4 h-4 text-gray-500" />
                    </button>
                    <button onClick={() => { if (confirm('Delete this config?')) deleteMutation.mutate(cfg.id as string); }}
                      className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded">
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </button>
                  </div>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                  {((cfg.steps as unknown[]) ?? []).length} steps ·
                  {cfg.send_to_whatsapp ? ' WhatsApp enabled' : ''} ·
                  Recovery: {cfg.recovery_delay_hours as number}h
                </p>
                <div className="flex flex-wrap gap-2">
                  {((cfg.steps as Array<Record<string, unknown>>) ?? []).map((s, i) => (
                    <span key={i} className="px-2 py-1 bg-emerald-100 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 rounded text-xs">
                      {i + 1}. {s.field as string} ({s.type as string})
                    </span>
                  ))}
                </div>
              </motion.div>
            ))}
          </div>
        </>
      )}

      {/* Leads Tab */}
      {tab === 'leads' && (
        <>
          <div className="flex gap-3 mb-4">
            <select className="input py-2 text-sm" value={leadFilter.status} onChange={(e) => setLeadFilter(f => ({ ...f, status: e.target.value }))}>
              <option value="">All Statuses</option>
              <option value="in_progress">In Progress</option>
              <option value="completed">Completed</option>
              <option value="dropped">Dropped</option>
              <option value="recovered">Recovered</option>
            </select>
            <select className="input py-2 text-sm" value={leadFilter.segment} onChange={(e) => setLeadFilter(f => ({ ...f, segment: e.target.value }))}>
              <option value="">All Segments</option>
              <option value="hot">🔴 Hot</option>
              <option value="warm">🟡 Warm</option>
              <option value="cold">🔵 Cold</option>
            </select>
          </div>
          {loadingLeads && <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-pink-500" /></div>}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400">
                  <th className="text-left p-3">User</th>
                  <th className="text-left p-3">Status</th>
                  <th className="text-left p-3">Segment</th>
                  <th className="text-left p-3">Score</th>
                  <th className="text-left p-3">Step</th>
                  <th className="text-left p-3">Date</th>
                </tr>
              </thead>
              <tbody>
                {leads.length === 0 && !loadingLeads && (
                  <tr><td colSpan={6} className="text-center py-8 text-gray-500 dark:text-gray-400">No leads found</td></tr>
                )}
                {leads.map((lead: Record<string, unknown>) => (
                  <tr key={lead.id as string} className="border-b border-gray-100 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700/30">
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <Users className="w-4 h-4 text-gray-400" />
                        <span className="font-medium text-gray-900 dark:text-white">{lead.ig_username ? `@${lead.ig_username}` : lead.ig_user_id as string}</span>
                      </div>
                    </td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        lead.status === 'completed' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                          : lead.status === 'dropped' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                          : lead.status === 'recovered' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                          : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                      }`}>
                        {String(lead.status)}
                      </span>
                    </td>
                    <td className="p-3">
                      {!!lead.segment && (
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${segmentColor(lead.segment as string)}`}>
                          {String(lead.segment)}
                        </span>
                      )}
                    </td>
                    <td className="p-3">
                      <div className="flex items-center gap-1">
                        <TrendingUp className="w-3 h-3 text-gray-400" />
                        <span className="text-gray-900 dark:text-white">{lead.score as number ?? 0}</span>
                      </div>
                    </td>
                    <td className="p-3 text-gray-500 dark:text-gray-400">{lead.current_step as number ?? 0}</td>
                    <td className="p-3 text-gray-500 dark:text-gray-400">{new Date(lead.created_at as string).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
});
