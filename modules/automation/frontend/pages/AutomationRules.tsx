import { useState, memo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { Zap, Plus, Trash2, ToggleLeft, ToggleRight, ChevronDown, ChevronUp, Clock, Calendar } from 'lucide-react';
import { automationApi } from '../../../../packages/ui/src/services/api';
import { cn, timeAgo } from '../../../../packages/utils/src/frontend-utils';
import toast from 'react-hot-toast';

type Channel = 'whatsapp' | 'sms' | 'email' | 'all';
type TriggerType = 'message_received' | 'message_failed' | 'no_reply' | 'campaign_completed' | 'lead_tagged' | 'lead_segment_changed' | 'scheduled';
type ActionType = 'send_reply' | 'tag_lead' | 'set_segment' | 'assign_thread' | 'escalate' | 'notify' | 'create_followup';
type ScheduleType = 'once' | 'daily' | 'weekly' | 'monthly';

interface AutomationRule {
  id: string;
  name: string;
  description: string | null;
  channel: Channel;
  trigger_type: TriggerType;
  trigger_config: Record<string, unknown>;
  conditions: Array<{ field: string; operator: string; value: unknown }>;
  actions: Array<{ type: ActionType; config: Record<string, unknown> }>;
  is_active: boolean;
  priority: number;
  trigger_count: number;
  last_triggered_at: string | null;
  created_at: string;
}

interface ScheduledCampaign {
  id: string;
  name: string;
  channel: 'whatsapp' | 'sms' | 'email';
  campaign_config: Record<string, unknown>;
  schedule_type: ScheduleType;
  scheduled_at: string;
  next_run_at: string | null;
  last_run_at: string | null;
  run_count: number;
  status: 'pending' | 'running' | 'completed' | 'paused' | 'failed';
}

const TRIGGER_LABELS: Record<TriggerType, string> = {
  message_received: 'Message Received',
  message_failed: 'Message Failed',
  no_reply: 'No Reply After',
  campaign_completed: 'Campaign Completed',
  lead_tagged: 'Lead Tagged',
  lead_segment_changed: 'Segment Changed',
  scheduled: 'Scheduled',
};

const ACTION_LABELS: Record<ActionType, string> = {
  send_reply: 'Send Auto-Reply',
  tag_lead: 'Tag Lead',
  set_segment: 'Set Segment',
  assign_thread: 'Assign Thread',
  escalate: 'Escalate',
  notify: 'Send Notification',
  create_followup: 'Create Follow-up',
};

const SEGMENT_COLOR: Record<string, string> = { hot: 'text-red-400', warm: 'text-orange-400', cold: 'text-blue-400' };
const STATUS_COLOR: Record<string, string> = { pending: 'text-yellow-400', running: 'text-blue-400', completed: 'text-emerald-400', paused: 'text-gray-400', failed: 'text-red-400' };

const emptyRule = {
  name: '', description: '', channel: 'all' as Channel,
  trigger_type: 'message_received' as TriggerType,
  trigger_config: {} as Record<string, unknown>,
  conditions: [] as Array<{ field: string; operator: string; value: string }>,
  actions: [{ type: 'notify' as ActionType, config: { message: '' } as Record<string, unknown> }],
  is_active: true, priority: 0,
};

export default memo(function AutomationRules() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'rules' | 'scheduled' | 'logs'>('rules');
  const [showCreateRule, setShowCreateRule] = useState(false);
  const [showCreateScheduled, setShowCreateScheduled] = useState(false);
  const [expandedRule, setExpandedRule] = useState<string | null>(null);
  const [form, setForm] = useState({ ...emptyRule });
  const [scheduledForm, setScheduledForm] = useState({
    name: '', channel: 'whatsapp' as 'whatsapp' | 'sms' | 'email',
    message: '', subject: '', phone_list: '', email_list: '',
    schedule_type: 'once' as ScheduleType, scheduled_at: '',
  });

  // ── Queries ────────────────────────────────────────────────────────────────
  const { data: rulesData } = useQuery({
    queryKey: ['automation-rules'],
    queryFn: () => automationApi.listRules(),
    refetchInterval: 30_000,
  });

  const { data: scheduledData } = useQuery({
    queryKey: ['scheduled-campaigns'],
    queryFn: () => automationApi.listScheduled(),
    refetchInterval: 30_000,
    enabled: activeTab === 'scheduled',
  });

  const { data: logsData } = useQuery({
    queryKey: ['automation-logs'],
    queryFn: () => automationApi.getLogs(),
    enabled: activeTab === 'logs',
    refetchInterval: 15_000,
  });

  const rules: AutomationRule[] = rulesData?.rules ?? [];
  const scheduled: ScheduledCampaign[] = scheduledData?.campaigns ?? [];
  const logs = logsData?.logs ?? [];

  // ── Mutations ──────────────────────────────────────────────────────────────
  const createRuleMutation = useMutation({
    mutationFn: (data: typeof form) => automationApi.createRule(data),
    onSuccess: () => { toast.success('Rule created'); setShowCreateRule(false); setForm({ ...emptyRule }); queryClient.invalidateQueries({ queryKey: ['automation-rules'] }); },
    onError: () => toast.error('Failed to create rule'),
  });

  const toggleMutation = useMutation({
    mutationFn: (id: string) => automationApi.toggleRule(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['automation-rules'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => automationApi.deleteRule(id),
    onSuccess: () => { toast.success('Rule deleted'); queryClient.invalidateQueries({ queryKey: ['automation-rules'] }); },
  });

  const createScheduledMutation = useMutation({
    mutationFn: () => {
      const contacts = scheduledForm.channel === 'email'
        ? scheduledForm.email_list.split('\n').filter(Boolean).map((e) => ({ email: e.trim() }))
        : scheduledForm.phone_list.split('\n').filter(Boolean).map((p) => ({ phone: p.trim() }));
      return automationApi.createScheduled({
        name: scheduledForm.name,
        channel: scheduledForm.channel,
        campaign_config: { contacts, message: scheduledForm.message, subject: scheduledForm.subject, campaign_name: scheduledForm.name },
        schedule_type: scheduledForm.schedule_type,
        scheduled_at: new Date(scheduledForm.scheduled_at).toISOString(),
      });
    },
    onSuccess: () => {
      toast.success('Campaign scheduled');
      setShowCreateScheduled(false);
      queryClient.invalidateQueries({ queryKey: ['scheduled-campaigns'] });
    },
    onError: () => toast.error('Failed to schedule campaign'),
  });

  const cancelScheduledMutation = useMutation({
    mutationFn: (id: string) => automationApi.cancelScheduled(id),
    onSuccess: () => { toast.success('Campaign paused'); queryClient.invalidateQueries({ queryKey: ['scheduled-campaigns'] }); },
  });

  const addCondition = () => setForm((f) => ({ ...f, conditions: [...f.conditions, { field: 'channel', operator: 'equals', value: '' }] }));
  const removeCondition = (i: number) => setForm((f) => ({ ...f, conditions: f.conditions.filter((_, idx) => idx !== i) }));
  const addAction = () => setForm((f) => ({ ...f, actions: [...f.actions, { type: 'notify' as ActionType, config: { message: '' } as Record<string, unknown> }] }));
  const removeAction = (i: number) => setForm((f) => ({ ...f, actions: f.actions.filter((_, idx) => idx !== i) }));

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-lg bg-brand-100 dark:bg-brand-600/20"><Zap className="w-6 h-6 text-brand-600 dark:text-brand-400" /></div>
        <div>
          <h1 className="text-2xl font-bold">Automation</h1>
          <p className="text-gray-500 dark:text-gray-400">Rules, scheduled campaigns, and smart triggers</p>
        </div>
        <div className="ml-auto flex gap-2">
          {activeTab === 'rules' && (
            <button className="btn-primary text-sm flex items-center gap-1.5" onClick={() => setShowCreateRule(true)}>
              <Plus className="w-4 h-4" /> New Rule
            </button>
          )}
          {activeTab === 'scheduled' && (
            <button className="btn-primary text-sm flex items-center gap-1.5" onClick={() => setShowCreateScheduled(true)}>
              <Plus className="w-4 h-4" /> Schedule Campaign
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 dark:bg-gray-900 rounded-lg p-1 w-fit">
        {(['rules', 'scheduled', 'logs'] as const).map((t) => (
          <button key={t} onClick={() => setActiveTab(t)}
            className={cn('px-4 py-1.5 rounded-md text-sm font-medium capitalize transition-all',
              activeTab === t ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            )}>{t}</button>
        ))}
      </div>

      {/* Rules Tab */}
      {activeTab === 'rules' && (
        <div className="space-y-3">
          {rules.length === 0 && !showCreateRule && (
            <div className="card p-8 text-center">
              <Zap className="w-10 h-10 mx-auto mb-3 text-gray-600" />
              <p className="text-gray-400">No automation rules yet</p>
              <button className="btn-primary mt-4 text-sm" onClick={() => setShowCreateRule(true)}>Create First Rule</button>
            </div>
          )}
          <AnimatePresence>
            {showCreateRule && (
              <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                className="card p-5 space-y-4">
                <h3 className="font-semibold text-gray-200">New Automation Rule</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="label">Rule Name *</label>
                    <input className="input w-full" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="e.g. Auto-tag hot leads" />
                  </div>
                  <div>
                    <label className="label">Channel</label>
                    <select className="input w-full" value={form.channel} onChange={(e) => setForm((f) => ({ ...f, channel: e.target.value as Channel }))}>
                      {['all', 'whatsapp', 'sms', 'email'].map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="label">Trigger</label>
                    <select className="input w-full" value={form.trigger_type} onChange={(e) => setForm((f) => ({ ...f, trigger_type: e.target.value as TriggerType }))}>
                      {(Object.entries(TRIGGER_LABELS) as [TriggerType, string][]).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="label">Priority (higher = first)</label>
                    <input type="number" className="input w-full" value={form.priority} onChange={(e) => setForm((f) => ({ ...f, priority: Number(e.target.value) }))} />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="label">Description (optional)</label>
                    <input className="input w-full" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="What does this rule do?" />
                  </div>
                </div>

                {/* Conditions */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="label mb-0">Conditions (optional — all must match)</label>
                    <button onClick={addCondition} className="text-xs text-brand-400 hover:text-brand-300 flex items-center gap-1"><Plus className="w-3 h-3" /> Add</button>
                  </div>
                  {form.conditions.map((cond, i) => (
                    <div key={i} className="flex gap-2 mb-2">
                      <input className="input flex-1 text-sm" placeholder="field (e.g. channel)" value={cond.field} onChange={(e) => setForm((f) => { const c = [...f.conditions]; c[i] = { ...c[i], field: e.target.value }; return { ...f, conditions: c }; })} />
                      <select className="input text-sm w-28" value={cond.operator} onChange={(e) => setForm((f) => { const c = [...f.conditions]; c[i] = { ...c[i], operator: e.target.value }; return { ...f, conditions: c }; })}>
                        {['equals', 'not_equals', 'contains', 'not_contains', 'in', 'not_in'].map((op) => <option key={op}>{op}</option>)}
                      </select>
                      <input className="input flex-1 text-sm" placeholder="value" value={cond.value as string} onChange={(e) => setForm((f) => { const c = [...f.conditions]; c[i] = { ...c[i], value: e.target.value }; return { ...f, conditions: c }; })} />
                      <button onClick={() => removeCondition(i)} className="p-1.5 hover:text-red-400 text-gray-500"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  ))}
                </div>

                {/* Actions */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="label mb-0">Actions *</label>
                    <button onClick={addAction} className="text-xs text-brand-400 hover:text-brand-300 flex items-center gap-1"><Plus className="w-3 h-3" /> Add</button>
                  </div>
                  {form.actions.map((action, i) => (
                    <div key={i} className="flex gap-2 mb-2 items-start">
                      <select className="input text-sm w-40" value={action.type} onChange={(e) => setForm((f) => { const a = [...f.actions]; a[i] = { ...a[i], type: e.target.value as ActionType, config: {} }; return { ...f, actions: a }; })}>
                        {(Object.entries(ACTION_LABELS) as [ActionType, string][]).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                      </select>
                      <ActionConfigFields actionType={action.type} config={action.config}
                        onChange={(cfg) => setForm((f) => { const a = [...f.actions]; a[i] = { ...a[i], config: cfg }; return { ...f, actions: a }; })} />
                      <button onClick={() => removeAction(i)} className="p-1.5 hover:text-red-400 text-gray-500 mt-0.5"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  ))}
                </div>

                <div className="flex gap-2 justify-end pt-2">
                  <button className="btn-secondary text-sm" onClick={() => { setShowCreateRule(false); setForm({ ...emptyRule }); }}>Cancel</button>
                  <button className="btn-primary text-sm" disabled={!form.name || form.actions.length === 0 || createRuleMutation.isPending}
                    onClick={() => createRuleMutation.mutate(form)}>Create Rule</button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {rules.map((rule) => (
            <motion.div key={rule.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="card p-4">
              <div className="flex items-start gap-3">
                <button onClick={() => toggleMutation.mutate(rule.id)}>
                  {rule.is_active
                    ? <ToggleRight className="w-6 h-6 text-emerald-400 flex-shrink-0" />
                    : <ToggleLeft className="w-6 h-6 text-gray-600 flex-shrink-0" />}
                </button>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-gray-200">{rule.name}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 capitalize">{rule.channel}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-brand-600/20 text-brand-300">{TRIGGER_LABELS[rule.trigger_type as TriggerType]}</span>
                    {rule.trigger_count > 0 && <span className="text-xs text-gray-500">× {rule.trigger_count}</span>}
                    {rule.last_triggered_at && <span className="text-xs text-gray-600">last {timeAgo(new Date(rule.last_triggered_at).getTime())}</span>}
                  </div>
                  {rule.description && <p className="text-xs text-gray-500 mt-1">{rule.description}</p>}
                  <div className="flex gap-1 mt-2 flex-wrap">
                    {rule.actions.map((a, i) => (
                      <span key={i} className="text-xs px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400">{ACTION_LABELS[a.type as ActionType] ?? a.type}</span>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => setExpandedRule(expandedRule === rule.id ? null : rule.id)} className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded text-gray-500">
                    {expandedRule === rule.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                  <button onClick={() => { if (confirm('Delete this rule?')) deleteMutation.mutate(rule.id); }}
                    className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded text-gray-600 hover:text-red-400">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <AnimatePresence>
                {expandedRule === rule.id && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                    className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-800 space-y-2 overflow-hidden">
                    {rule.conditions.length > 0 && (
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Conditions</p>
                        {rule.conditions.map((c, i) => (
                          <p key={i} className="text-xs text-gray-400 font-mono">{c.field} {c.operator} {String(c.value)}</p>
                        ))}
                      </div>
                    )}
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Actions</p>
                      {rule.actions.map((a, i) => (
                        <p key={i} className="text-xs text-gray-400 font-mono">{a.type}: {JSON.stringify(a.config)}</p>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </div>
      )}

      {/* Scheduled Campaigns Tab */}
      {activeTab === 'scheduled' && (
        <div className="space-y-3">
          <AnimatePresence>
            {showCreateScheduled && (
              <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="card p-5 space-y-4">
                <h3 className="font-semibold text-gray-200 flex items-center gap-2"><Calendar className="w-4 h-4" /> Schedule Campaign</h3>
                <div className="grid sm:grid-cols-2 gap-3">
                  <div>
                    <label className="label">Campaign Name *</label>
                    <input className="input w-full" value={scheduledForm.name} onChange={(e) => setScheduledForm((f) => ({ ...f, name: e.target.value }))} placeholder="Black Friday Promo" />
                  </div>
                  <div>
                    <label className="label">Channel</label>
                    <select className="input w-full" value={scheduledForm.channel} onChange={(e) => setScheduledForm((f) => ({ ...f, channel: e.target.value as 'whatsapp' | 'sms' | 'email' }))}>
                      {['whatsapp', 'sms', 'email'].map((c) => <option key={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="label">Schedule Type</label>
                    <select className="input w-full" value={scheduledForm.schedule_type} onChange={(e) => setScheduledForm((f) => ({ ...f, schedule_type: e.target.value as ScheduleType }))}>
                      {(['once', 'daily', 'weekly', 'monthly'] as ScheduleType[]).map((s) => <option key={s}>{s}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="label">Scheduled At *</label>
                    <input type="datetime-local" className="input w-full" value={scheduledForm.scheduled_at} onChange={(e) => setScheduledForm((f) => ({ ...f, scheduled_at: e.target.value }))} />
                  </div>
                  {scheduledForm.channel === 'email' ? (
                    <>
                      <div>
                        <label className="label">Subject</label>
                        <input className="input w-full" value={scheduledForm.subject} onChange={(e) => setScheduledForm((f) => ({ ...f, subject: e.target.value }))} />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="label">Email List (one per line)</label>
                        <textarea className="input w-full" rows={3} value={scheduledForm.email_list} onChange={(e) => setScheduledForm((f) => ({ ...f, email_list: e.target.value }))} placeholder="user@example.com" />
                      </div>
                    </>
                  ) : (
                    <div className="sm:col-span-2">
                      <label className="label">Phone Numbers (one per line)</label>
                      <textarea className="input w-full" rows={3} value={scheduledForm.phone_list} onChange={(e) => setScheduledForm((f) => ({ ...f, phone_list: e.target.value }))} placeholder="+1234567890" />
                    </div>
                  )}
                  <div className="sm:col-span-2">
                    <label className="label">Message *</label>
                    <textarea className="input w-full" rows={3} value={scheduledForm.message} onChange={(e) => setScheduledForm((f) => ({ ...f, message: e.target.value }))} />
                  </div>
                </div>
                <div className="flex gap-2 justify-end">
                  <button className="btn-secondary text-sm" onClick={() => setShowCreateScheduled(false)}>Cancel</button>
                  <button className="btn-primary text-sm"
                    disabled={!scheduledForm.name || !scheduledForm.message || !scheduledForm.scheduled_at || createScheduledMutation.isPending}
                    onClick={() => createScheduledMutation.mutate()}>Schedule</button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {scheduled.length === 0 && !showCreateScheduled && (
            <div className="card p-8 text-center">
              <Calendar className="w-10 h-10 mx-auto mb-3 text-gray-600" />
              <p className="text-gray-400">No scheduled campaigns</p>
              <button className="btn-primary mt-4 text-sm" onClick={() => setShowCreateScheduled(true)}>Schedule One</button>
            </div>
          )}
          {scheduled.map((sc) => (
            <div key={sc.id} className="card p-4 flex items-start gap-3">
              <Clock className="w-5 h-5 text-gray-500 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-gray-200">{sc.name}</span>
                  <span className={cn('text-xs font-medium capitalize', STATUS_COLOR[sc.status])}>{sc.status}</span>
                  <span className="text-xs px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 capitalize">{sc.channel}</span>
                  <span className="text-xs px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 capitalize">{sc.schedule_type}</span>
                  {sc.run_count > 0 && <span className="text-xs text-gray-600">ran {sc.run_count}×</span>}
                </div>
                <div className="flex gap-4 mt-1 text-xs text-gray-500">
                  <span>Scheduled: {new Date(sc.scheduled_at).toLocaleString()}</span>
                  {sc.next_run_at && <span>Next: {new Date(sc.next_run_at).toLocaleString()}</span>}
                  {sc.last_run_at && <span>Last: {timeAgo(new Date(sc.last_run_at).getTime())}</span>}
                </div>
              </div>
              {sc.status === 'pending' && (
                <button onClick={() => cancelScheduledMutation.mutate(sc.id)} className="text-xs text-orange-400 hover:text-orange-300">Pause</button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Logs Tab */}
      {activeTab === 'logs' && (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-800">
                <th className="text-left p-3 text-gray-400 font-medium">Rule</th>
                <th className="text-left p-3 text-gray-400 font-medium">Trigger</th>
                <th className="text-left p-3 text-gray-400 font-medium">Actions</th>
                <th className="text-left p-3 text-gray-400 font-medium">Status</th>
                <th className="text-left p-3 text-gray-400 font-medium">Time</th>
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 && (
                <tr><td colSpan={5} className="text-center p-8 text-gray-500">No automation logs yet</td></tr>
              )}
              {logs.map((log: Record<string, unknown>) => (
                <tr key={log.id as string} className="border-b border-gray-200/50 dark:border-gray-800/50">
                  <td className="p-3 text-gray-300">{(log.rule_name as string) ?? 'Deleted rule'}</td>
                  <td className="p-3 text-gray-400 text-xs">{TRIGGER_LABELS[log.trigger_type as TriggerType] ?? log.trigger_type as string}</td>
                  <td className="p-3 text-gray-400 text-xs">{(log.actions_executed as Array<{ type: string }>)?.length ?? 0} action(s)</td>
                  <td className="p-3">
                    <span className={cn('text-xs font-medium', (log.status as string) === 'success' ? 'text-emerald-400' : (log.status as string) === 'partial' ? 'text-yellow-400' : 'text-red-400')}>
                      {log.status as string}
                    </span>
                  </td>
                  <td className="p-3 text-gray-500 text-xs">{timeAgo(new Date(log.created_at as string).getTime())}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
});

function ActionConfigFields({ actionType, config, onChange }: {
  actionType: ActionType;
  config: Record<string, unknown>;
  onChange: (cfg: Record<string, unknown>) => void;
}) {
  const update = (key: string, val: string) => onChange({ ...config, [key]: val });
  switch (actionType) {
    case 'send_reply': return <input className="input flex-1 text-sm" placeholder="Reply message…" value={(config.body as string) ?? ''} onChange={(e) => update('body', e.target.value)} />;
    case 'tag_lead': return <input className="input flex-1 text-sm" placeholder="Comma-separated tags…" value={(config.tags as string) ?? ''} onChange={(e) => onChange({ tags: e.target.value.split(',').map(t => t.trim()) })} />;
    case 'set_segment': return (
      <select className="input text-sm flex-1" value={(config.segment as string) ?? 'cold'} onChange={(e) => update('segment', e.target.value)}>
        {['hot', 'warm', 'cold'].map((s) => <option key={s} value={s} className={SEGMENT_COLOR[s]}>{s}</option>)}
      </select>
    );
    case 'assign_thread': return <input className="input flex-1 text-sm" placeholder="Assign to (name)…" value={(config.assigned_to as string) ?? ''} onChange={(e) => update('assigned_to', e.target.value)} />;
    case 'escalate': return <input className="input flex-1 text-sm" placeholder="Escalation reason…" value={(config.reason as string) ?? ''} onChange={(e) => update('reason', e.target.value)} />;
    case 'create_followup': return (
      <div className="flex gap-2 flex-1">
        <input type="number" className="input w-20 text-sm" placeholder="Hours" value={(config.delay_hours as string) ?? '24'} onChange={(e) => update('delay_hours', e.target.value)} />
        <input className="input flex-1 text-sm" placeholder="Follow-up message…" value={(config.message as string) ?? ''} onChange={(e) => update('message', e.target.value)} />
      </div>
    );
    default: return <input className="input flex-1 text-sm" placeholder="Notification message…" value={(config.message as string) ?? ''} onChange={(e) => update('message', e.target.value)} />;
  }
}
