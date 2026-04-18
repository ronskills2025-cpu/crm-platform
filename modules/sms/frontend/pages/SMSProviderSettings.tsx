import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Trash2, Edit2, Shield, FileText, Phone, MapPin, Globe, X, Check, AlertCircle, Server } from 'lucide-react';
import { smsApi } from '../../../../packages/ui/src/services/api';
import { cn } from '../../../../packages/utils/src/frontend-utils';
import toast from 'react-hot-toast';

type Tab = 'self-gateway' | 'dlt-entities' | 'dlt-templates' | 'sender-ids' | 'virtual-numbers' | 'region-routes';

export default function SMSProviderSettings() {
  const [tab, setTab] = useState<Tab>('self-gateway');
  const queryClient = useQueryClient();

  const tabs: { key: Tab; label: string; icon: typeof Shield }[] = [
    { key: 'self-gateway', label: 'My Gateway', icon: Server },
    { key: 'dlt-entities', label: 'DLT Entities', icon: Shield },
    { key: 'dlt-templates', label: 'DLT Templates', icon: FileText },
    { key: 'sender-ids', label: 'Sender IDs', icon: Phone },
    { key: 'virtual-numbers', label: 'Virtual Numbers', icon: Globe },
    { key: 'region-routes', label: 'Region Routes', icon: MapPin },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">SMS Provider Settings</h1>
        <p className="text-sm text-gray-400 mt-1">Configure your own SMS gateway, manage DLT compliance, virtual numbers for unofficial sending, and region-based routing</p>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-1 bg-gray-800/50 p-1 rounded-lg border border-gray-700 overflow-x-auto">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap',
              tab === t.key ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-700/50'
            )}
          >
            <t.icon className="w-4 h-4" />
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <AnimatePresence mode="wait">
        <motion.div key={tab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
          {tab === 'self-gateway' && <SelfGatewayTab />}
          {tab === 'dlt-entities' && <DLTEntitiesTab queryClient={queryClient} />}
          {tab === 'dlt-templates' && <DLTTemplatesTab queryClient={queryClient} />}
          {tab === 'sender-ids' && <SenderIdsTab queryClient={queryClient} />}
          {tab === 'virtual-numbers' && <VirtualNumbersTab queryClient={queryClient} />}
          {tab === 'region-routes' && <RegionRoutesTab queryClient={queryClient} />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

// ── Self Gateway Config Tab ──────────────────────────────────────

function SelfGatewayTab() {
  const [form, setForm] = useState({
    gatewayUrl: '',
    apiKey: '',
    apiSecret: '',
    senderId: '',
    method: 'POST',
    headers: '',
  });
  const [saved, setSaved] = useState(false);

  const saveMut = useMutation({
    mutationFn: async () => {
      const { default: api } = await import('../../../../packages/utils/src/http');
      return api.post('/providers', {
        channel: 'sms',
        name: 'self',
        display_name: 'My SMS Gateway',
        priority: 0,
        cost_per_msg: 0,
        rate_per_sec: 50,
        credentials: {
          provider: 'self',
          gatewayUrl: form.gatewayUrl,
          apiKey: form.apiKey,
          apiSecret: form.apiSecret,
          senderId: form.senderId,
          method: form.method,
          headers: form.headers,
        },
        is_active: true,
      }).then((r) => r.data);
    },
    onSuccess: () => { setSaved(true); toast.success('Gateway configuration saved'); },
    onError: () => toast.error('Failed to save gateway config'),
  });

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold text-white">Your SMS Gateway</h3>
        <p className="text-sm text-gray-400 mt-1">
          Configure your own SMS sending gateway. You are the provider — send SMS through your own API endpoint with or without DLT compliance.
        </p>
      </div>

      <div className="bg-gray-800 border border-gray-700 rounded-lg p-6 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="block text-sm text-gray-400 mb-1">Gateway API URL</label>
            <input
              placeholder="https://your-gateway.example.com/api/send"
              value={form.gatewayUrl}
              onChange={(e) => setForm({ ...form, gatewayUrl: e.target.value })}
              className="w-full bg-gray-900 border border-gray-600 rounded px-3 py-2 text-white text-sm"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">API Key</label>
            <input
              type="password"
              placeholder="Your API key"
              value={form.apiKey}
              onChange={(e) => setForm({ ...form, apiKey: e.target.value })}
              className="w-full bg-gray-900 border border-gray-600 rounded px-3 py-2 text-white text-sm"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">API Secret (optional)</label>
            <input
              type="password"
              placeholder="Your API secret"
              value={form.apiSecret}
              onChange={(e) => setForm({ ...form, apiSecret: e.target.value })}
              className="w-full bg-gray-900 border border-gray-600 rounded px-3 py-2 text-white text-sm"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Default Sender ID</label>
            <input
              placeholder="e.g., MYBRAND or +919876543210"
              value={form.senderId}
              onChange={(e) => setForm({ ...form, senderId: e.target.value })}
              className="w-full bg-gray-900 border border-gray-600 rounded px-3 py-2 text-white text-sm"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">HTTP Method</label>
            <select
              value={form.method}
              onChange={(e) => setForm({ ...form, method: e.target.value })}
              className="w-full bg-gray-900 border border-gray-600 rounded px-3 py-2 text-white text-sm"
            >
              <option value="POST">POST</option>
              <option value="PUT">PUT</option>
            </select>
          </div>
          <div className="col-span-2">
            <label className="block text-sm text-gray-400 mb-1">Custom Headers (JSON, optional)</label>
            <input
              placeholder='{"X-Custom-Header": "value"}'
              value={form.headers}
              onChange={(e) => setForm({ ...form, headers: e.target.value })}
              className="w-full bg-gray-900 border border-gray-600 rounded px-3 py-2 text-white text-sm"
            />
          </div>
        </div>

        <div className="flex items-center gap-3 pt-2">
          <button
            onClick={() => saveMut.mutate()}
            disabled={!form.gatewayUrl || saveMut.isPending}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50"
          >
            {saveMut.isPending ? 'Saving...' : 'Save Gateway Config'}
          </button>
          {saved && <span className="text-green-400 text-sm flex items-center gap-1"><Check className="w-4 h-4" /> Saved</span>}
        </div>
      </div>

      {/* Info boxes */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
          <h4 className="text-blue-400 font-medium text-sm mb-2">DLT Mode (Official)</h4>
          <p className="text-xs text-gray-400">
            When DLT mode is enabled in a campaign, the system sends DLT entity ID and template ID to your gateway.
            Use this for official transactional/promotional SMS in India per TRAI regulations.
          </p>
        </div>
        <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-4">
          <h4 className="text-purple-400 font-medium text-sm mb-2">Non-DLT Mode (Unofficial)</h4>
          <p className="text-xs text-gray-400">
            Without DLT, the system can auto-pick a virtual number from your pool as sender.
            Manage virtual numbers in the "Virtual Numbers" tab.
          </p>
        </div>
      </div>
    </div>
  );
}

// ── DLT Entities Tab ────────────────────────────────────────────

function DLTEntitiesTab({ queryClient }: { queryClient: ReturnType<typeof useQueryClient> }) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ entity_name: '', entity_id: '', telecom_circle: '' });

  const { data, isLoading } = useQuery({ queryKey: ['sms-dlt-entities'], queryFn: smsApi.listDLTEntities, refetchInterval: 30_000 });
  const createMut = useMutation({
    mutationFn: () => smsApi.createDLTEntity(form),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['sms-dlt-entities'] }); setShowForm(false); setForm({ entity_name: '', entity_id: '', telecom_circle: '' }); toast.success('DLT entity created'); },
    onError: () => toast.error('Failed to create entity'),
  });
  const deleteMut = useMutation({
    mutationFn: (id: string) => smsApi.deleteDLTEntity(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['sms-dlt-entities'] }); toast.success('Entity deleted'); },
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold text-white">DLT Registered Entities</h3>
        <button onClick={() => setShowForm(true)} className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">
          <Plus className="w-4 h-4" /> Add Entity
        </button>
      </div>

      {showForm && (
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <input placeholder="Entity Name" value={form.entity_name} onChange={(e) => setForm({ ...form, entity_name: e.target.value })} className="bg-gray-900 border border-gray-600 rounded px-3 py-2 text-white text-sm" />
            <input placeholder="Entity ID (DLT)" value={form.entity_id} onChange={(e) => setForm({ ...form, entity_id: e.target.value })} className="bg-gray-900 border border-gray-600 rounded px-3 py-2 text-white text-sm" />
            <input placeholder="Telecom Circle" value={form.telecom_circle} onChange={(e) => setForm({ ...form, telecom_circle: e.target.value })} className="bg-gray-900 border border-gray-600 rounded px-3 py-2 text-white text-sm" />
          </div>
          <div className="flex gap-2">
            <button onClick={() => createMut.mutate()} disabled={!form.entity_name || !form.entity_id} className="px-4 py-2 bg-green-600 text-white rounded text-sm hover:bg-green-700 disabled:opacity-50"><Check className="w-4 h-4 inline mr-1" />Save</button>
            <button onClick={() => setShowForm(false)} className="px-4 py-2 bg-gray-700 text-white rounded text-sm hover:bg-gray-600"><X className="w-4 h-4 inline mr-1" />Cancel</button>
          </div>
        </div>
      )}

      {isLoading ? <div className="text-gray-400 text-sm">Loading...</div> : (
        <div className="bg-gray-800/50 border border-gray-700 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-800"><tr><th className="px-4 py-3 text-left text-gray-400">Entity Name</th><th className="px-4 py-3 text-left text-gray-400">Entity ID</th><th className="px-4 py-3 text-left text-gray-400">Telecom Circle</th><th className="px-4 py-3 text-left text-gray-400">Status</th><th className="px-4 py-3 text-right text-gray-400">Actions</th></tr></thead>
            <tbody className="divide-y divide-gray-700">
              {(data?.entities || []).map((e: Record<string, unknown>) => (
                <tr key={e.id as string} className="hover:bg-gray-800/30">
                  <td className="px-4 py-3 text-white">{e.entity_name as string}</td>
                  <td className="px-4 py-3 text-gray-300 font-mono text-xs">{e.entity_id as string}</td>
                  <td className="px-4 py-3 text-gray-300">{(e.telecom_circle as string) || '—'}</td>
                  <td className="px-4 py-3"><span className={cn('px-2 py-1 rounded-full text-xs', e.is_active ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400')}>{e.is_active ? 'Active' : 'Inactive'}</span></td>
                  <td className="px-4 py-3 text-right"><button onClick={() => deleteMut.mutate(e.id as string)} className="text-red-400 hover:text-red-300"><Trash2 className="w-4 h-4" /></button></td>
                </tr>
              ))}
              {(!data?.entities?.length) && <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-500">No DLT entities registered</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── DLT Templates Tab ───────────────────────────────────────────

function DLTTemplatesTab({ queryClient }: { queryClient: ReturnType<typeof useQueryClient> }) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ entity_id: '', template_id: '', template_name: '', content_template: '', message_type: 'transactional' });

  const { data: entities } = useQuery({ queryKey: ['sms-dlt-entities'], queryFn: smsApi.listDLTEntities });
  const { data, isLoading } = useQuery({ queryKey: ['sms-dlt-templates'], queryFn: () => smsApi.listDLTTemplates(), refetchInterval: 30_000 });

  const createMut = useMutation({
    mutationFn: () => smsApi.createDLTTemplate({ ...form, variables: [] }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['sms-dlt-templates'] }); setShowForm(false); toast.success('DLT template created'); },
    onError: () => toast.error('Failed to create template'),
  });
  const deleteMut = useMutation({
    mutationFn: (id: string) => smsApi.deleteDLTTemplate(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['sms-dlt-templates'] }); toast.success('Template deleted'); },
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold text-white">DLT Message Templates</h3>
        <button onClick={() => setShowForm(true)} className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"><Plus className="w-4 h-4" /> Add Template</button>
      </div>

      {showForm && (
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <select value={form.entity_id} onChange={(e) => setForm({ ...form, entity_id: e.target.value })} className="bg-gray-900 border border-gray-600 rounded px-3 py-2 text-white text-sm">
              <option value="">Select Entity</option>
              {(entities?.entities || []).map((e: Record<string, unknown>) => <option key={e.id as string} value={e.id as string}>{e.entity_name as string}</option>)}
            </select>
            <input placeholder="Template ID (DLT)" value={form.template_id} onChange={(e) => setForm({ ...form, template_id: e.target.value })} className="bg-gray-900 border border-gray-600 rounded px-3 py-2 text-white text-sm" />
          </div>
          <input placeholder="Template Name" value={form.template_name} onChange={(e) => setForm({ ...form, template_name: e.target.value })} className="w-full bg-gray-900 border border-gray-600 rounded px-3 py-2 text-white text-sm" />
          <textarea placeholder="Content Template (use {#var#} for variables)" value={form.content_template} onChange={(e) => setForm({ ...form, content_template: e.target.value })} rows={3} className="w-full bg-gray-900 border border-gray-600 rounded px-3 py-2 text-white text-sm" />
          <select value={form.message_type} onChange={(e) => setForm({ ...form, message_type: e.target.value })} className="bg-gray-900 border border-gray-600 rounded px-3 py-2 text-white text-sm">
            <option value="transactional">Transactional</option>
            <option value="promotional">Promotional</option>
            <option value="service_implicit">Service (Implicit)</option>
            <option value="service_explicit">Service (Explicit)</option>
          </select>
          <div className="flex gap-2">
            <button onClick={() => createMut.mutate()} disabled={!form.entity_id || !form.template_id || !form.template_name} className="px-4 py-2 bg-green-600 text-white rounded text-sm hover:bg-green-700 disabled:opacity-50"><Check className="w-4 h-4 inline mr-1" />Save</button>
            <button onClick={() => setShowForm(false)} className="px-4 py-2 bg-gray-700 text-white rounded text-sm hover:bg-gray-600"><X className="w-4 h-4 inline mr-1" />Cancel</button>
          </div>
        </div>
      )}

      {isLoading ? <div className="text-gray-400 text-sm">Loading...</div> : (
        <div className="space-y-3">
          {(data?.templates || []).map((t: Record<string, unknown>) => (
            <div key={t.id as string} className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
              <div className="flex justify-between items-start">
                <div>
                  <h4 className="text-white font-medium">{t.template_name as string}</h4>
                  <p className="text-xs text-gray-400 mt-1 font-mono">{t.template_id as string}</p>
                  <p className="text-sm text-gray-300 mt-2">{t.content_template as string}</p>
                  <div className="flex gap-2 mt-2">
                    <span className="text-xs px-2 py-1 bg-blue-500/20 text-blue-400 rounded">{t.message_type as string}</span>
                    {t.entity_name ? <span className="text-xs px-2 py-1 bg-gray-700 text-gray-300 rounded">{String(t.entity_name)}</span> : null}
                  </div>
                </div>
                <button onClick={() => deleteMut.mutate(t.id as string)} className="text-red-400 hover:text-red-300"><Trash2 className="w-4 h-4" /></button>
              </div>
            </div>
          ))}
          {(!data?.templates?.length) && <div className="text-center text-gray-500 py-8">No DLT templates registered</div>}
        </div>
      )}
    </div>
  );
}

// ── Sender IDs Tab ───────────────────────────────────────────────

function SenderIdsTab({ queryClient }: { queryClient: ReturnType<typeof useQueryClient> }) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ sender_id: '', type: 'alphanumeric', region: '', description: '' });

  const { data, isLoading } = useQuery({ queryKey: ['sms-sender-ids'], queryFn: smsApi.listSenderIds, refetchInterval: 30_000 });
  const createMut = useMutation({
    mutationFn: () => smsApi.createSenderId(form),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['sms-sender-ids'] }); setShowForm(false); setForm({ sender_id: '', type: 'alphanumeric', region: '', description: '' }); toast.success('Sender ID created'); },
    onError: () => toast.error('Failed to create sender ID'),
  });
  const deleteMut = useMutation({
    mutationFn: (id: string) => smsApi.deleteSenderId(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['sms-sender-ids'] }); toast.success('Sender ID deleted'); },
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold text-white">Sender IDs</h3>
        <button onClick={() => setShowForm(true)} className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"><Plus className="w-4 h-4" /> Add Sender ID</button>
      </div>

      {showForm && (
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 space-y-3">
          <div className="grid grid-cols-4 gap-3">
            <input placeholder="Sender ID" value={form.sender_id} onChange={(e) => setForm({ ...form, sender_id: e.target.value })} className="bg-gray-900 border border-gray-600 rounded px-3 py-2 text-white text-sm" />
            <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="bg-gray-900 border border-gray-600 rounded px-3 py-2 text-white text-sm">
              <option value="alphanumeric">Alphanumeric</option>
              <option value="numeric">Numeric</option>
              <option value="shortcode">Shortcode</option>
            </select>
            <input placeholder="Region (e.g., IN)" value={form.region} onChange={(e) => setForm({ ...form, region: e.target.value })} className="bg-gray-900 border border-gray-600 rounded px-3 py-2 text-white text-sm" />
            <input placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="bg-gray-900 border border-gray-600 rounded px-3 py-2 text-white text-sm" />
          </div>
          <div className="flex gap-2">
            <button onClick={() => createMut.mutate()} disabled={!form.sender_id} className="px-4 py-2 bg-green-600 text-white rounded text-sm hover:bg-green-700 disabled:opacity-50"><Check className="w-4 h-4 inline mr-1" />Save</button>
            <button onClick={() => setShowForm(false)} className="px-4 py-2 bg-gray-700 text-white rounded text-sm hover:bg-gray-600"><X className="w-4 h-4 inline mr-1" />Cancel</button>
          </div>
        </div>
      )}

      {isLoading ? <div className="text-gray-400 text-sm">Loading...</div> : (
        <div className="bg-gray-800/50 border border-gray-700 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-800"><tr><th className="px-4 py-3 text-left text-gray-400">Sender ID</th><th className="px-4 py-3 text-left text-gray-400">Type</th><th className="px-4 py-3 text-left text-gray-400">Region</th><th className="px-4 py-3 text-left text-gray-400">Approval</th><th className="px-4 py-3 text-left text-gray-400">Status</th><th className="px-4 py-3 text-right text-gray-400">Actions</th></tr></thead>
            <tbody className="divide-y divide-gray-700">
              {(data?.senderIds || []).map((s: Record<string, unknown>) => (
                <tr key={s.id as string} className="hover:bg-gray-800/30">
                  <td className="px-4 py-3 text-white font-mono">{s.sender_id as string}</td>
                  <td className="px-4 py-3 text-gray-300 capitalize">{s.type as string}</td>
                  <td className="px-4 py-3 text-gray-300">{(s.region as string) || '—'}</td>
                  <td className="px-4 py-3"><span className={cn('px-2 py-1 rounded-full text-xs', s.approval_status === 'approved' ? 'bg-green-500/20 text-green-400' : s.approval_status === 'pending' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-red-500/20 text-red-400')}>{s.approval_status as string}</span></td>
                  <td className="px-4 py-3"><span className={cn('px-2 py-1 rounded-full text-xs', s.is_active ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400')}>{s.is_active ? 'Active' : 'Inactive'}</span></td>
                  <td className="px-4 py-3 text-right"><button onClick={() => deleteMut.mutate(s.id as string)} className="text-red-400 hover:text-red-300"><Trash2 className="w-4 h-4" /></button></td>
                </tr>
              ))}
              {(!data?.senderIds?.length) && <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-500">No sender IDs registered</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Virtual Numbers Tab ──────────────────────────────────────────

function VirtualNumbersTab({ queryClient }: { queryClient: ReturnType<typeof useQueryClient> }) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ phone_number: '', provider: '', region: '' });

  const { data, isLoading } = useQuery({ queryKey: ['sms-virtual-numbers'], queryFn: smsApi.listVirtualNumbers, refetchInterval: 30_000 });
  const createMut = useMutation({
    mutationFn: () => smsApi.createVirtualNumber(form),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['sms-virtual-numbers'] }); setShowForm(false); setForm({ phone_number: '', provider: '', region: '' }); toast.success('Virtual number added'); },
    onError: () => toast.error('Failed to add number'),
  });
  const deleteMut = useMutation({
    mutationFn: (id: string) => smsApi.deleteVirtualNumber(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['sms-virtual-numbers'] }); toast.success('Number removed'); },
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold text-white">Virtual Numbers</h3>
        <button onClick={() => setShowForm(true)} className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"><Plus className="w-4 h-4" /> Add Number</button>
      </div>

      {showForm && (
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <input placeholder="Phone Number" value={form.phone_number} onChange={(e) => setForm({ ...form, phone_number: e.target.value })} className="bg-gray-900 border border-gray-600 rounded px-3 py-2 text-white text-sm" />
            <input placeholder="Provider (e.g., twilio)" value={form.provider} onChange={(e) => setForm({ ...form, provider: e.target.value })} className="bg-gray-900 border border-gray-600 rounded px-3 py-2 text-white text-sm" />
            <input placeholder="Region" value={form.region} onChange={(e) => setForm({ ...form, region: e.target.value })} className="bg-gray-900 border border-gray-600 rounded px-3 py-2 text-white text-sm" />
          </div>
          <div className="flex gap-2">
            <button onClick={() => createMut.mutate()} disabled={!form.phone_number || !form.provider} className="px-4 py-2 bg-green-600 text-white rounded text-sm hover:bg-green-700 disabled:opacity-50"><Check className="w-4 h-4 inline mr-1" />Save</button>
            <button onClick={() => setShowForm(false)} className="px-4 py-2 bg-gray-700 text-white rounded text-sm hover:bg-gray-600"><X className="w-4 h-4 inline mr-1" />Cancel</button>
          </div>
        </div>
      )}

      {isLoading ? <div className="text-gray-400 text-sm">Loading...</div> : (
        <div className="bg-gray-800/50 border border-gray-700 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-800"><tr><th className="px-4 py-3 text-left text-gray-400">Phone Number</th><th className="px-4 py-3 text-left text-gray-400">Provider</th><th className="px-4 py-3 text-left text-gray-400">Region</th><th className="px-4 py-3 text-left text-gray-400">Status</th><th className="px-4 py-3 text-right text-gray-400">Actions</th></tr></thead>
            <tbody className="divide-y divide-gray-700">
              {(data?.numbers || []).map((n: Record<string, unknown>) => (
                <tr key={n.id as string} className="hover:bg-gray-800/30">
                  <td className="px-4 py-3 text-white font-mono">{n.phone_number as string}</td>
                  <td className="px-4 py-3 text-gray-300">{n.provider as string}</td>
                  <td className="px-4 py-3 text-gray-300">{(n.region as string) || '—'}</td>
                  <td className="px-4 py-3"><span className={cn('px-2 py-1 rounded-full text-xs', n.is_active ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400')}>{n.is_active ? 'Active' : 'Inactive'}</span></td>
                  <td className="px-4 py-3 text-right"><button onClick={() => deleteMut.mutate(n.id as string)} className="text-red-400 hover:text-red-300"><Trash2 className="w-4 h-4" /></button></td>
                </tr>
              ))}
              {(!data?.numbers?.length) && <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-500">No virtual numbers configured</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Region Routes Tab ────────────────────────────────────────────

function RegionRoutesTab({ queryClient }: { queryClient: ReturnType<typeof useQueryClient> }) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ region: '', provider_chain: '', requires_dlt: false, default_sender_id: '' });

  const { data, isLoading } = useQuery({ queryKey: ['sms-region-routes'], queryFn: smsApi.listRegionRoutes, refetchInterval: 30_000 });
  const upsertMut = useMutation({
    mutationFn: () => smsApi.upsertRegionRoute({ ...form, provider_chain: form.provider_chain.split(',').map(s => s.trim()).filter(Boolean) }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['sms-region-routes'] }); setShowForm(false); setForm({ region: '', provider_chain: '', requires_dlt: false, default_sender_id: '' }); toast.success('Route saved'); },
    onError: () => toast.error('Failed to save route'),
  });
  const deleteMut = useMutation({
    mutationFn: (id: string) => smsApi.deleteRegionRoute(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['sms-region-routes'] }); toast.success('Route deleted'); },
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold text-white">Region-Based Routing</h3>
        <button onClick={() => setShowForm(true)} className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"><Plus className="w-4 h-4" /> Add Route</button>
      </div>

      {showForm && (
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <input placeholder="Region (e.g., IN, US)" value={form.region} onChange={(e) => setForm({ ...form, region: e.target.value })} className="bg-gray-900 border border-gray-600 rounded px-3 py-2 text-white text-sm" />
            <input placeholder="Provider Chain (comma-separated)" value={form.provider_chain} onChange={(e) => setForm({ ...form, provider_chain: e.target.value })} className="bg-gray-900 border border-gray-600 rounded px-3 py-2 text-white text-sm" />
            <input placeholder="Default Sender ID" value={form.default_sender_id} onChange={(e) => setForm({ ...form, default_sender_id: e.target.value })} className="bg-gray-900 border border-gray-600 rounded px-3 py-2 text-white text-sm" />
            <label className="flex items-center gap-2 text-sm text-gray-300">
              <input type="checkbox" checked={form.requires_dlt} onChange={(e) => setForm({ ...form, requires_dlt: e.target.checked })} className="rounded border-gray-600" />
              Requires DLT Compliance
            </label>
          </div>
          <div className="flex gap-2">
            <button onClick={() => upsertMut.mutate()} disabled={!form.region || !form.provider_chain} className="px-4 py-2 bg-green-600 text-white rounded text-sm hover:bg-green-700 disabled:opacity-50"><Check className="w-4 h-4 inline mr-1" />Save</button>
            <button onClick={() => setShowForm(false)} className="px-4 py-2 bg-gray-700 text-white rounded text-sm hover:bg-gray-600"><X className="w-4 h-4 inline mr-1" />Cancel</button>
          </div>
        </div>
      )}

      {isLoading ? <div className="text-gray-400 text-sm">Loading...</div> : (
        <div className="bg-gray-800/50 border border-gray-700 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-800"><tr><th className="px-4 py-3 text-left text-gray-400">Region</th><th className="px-4 py-3 text-left text-gray-400">Provider Chain</th><th className="px-4 py-3 text-left text-gray-400">DLT Required</th><th className="px-4 py-3 text-left text-gray-400">Sender ID</th><th className="px-4 py-3 text-right text-gray-400">Actions</th></tr></thead>
            <tbody className="divide-y divide-gray-700">
              {(data?.routes || []).map((r: Record<string, unknown>) => {
                const chain = Array.isArray(r.provider_chain) ? r.provider_chain : typeof r.provider_chain === 'string' ? JSON.parse(r.provider_chain as string) : [];
                return (
                  <tr key={r.id as string} className="hover:bg-gray-800/30">
                    <td className="px-4 py-3 text-white font-medium">{r.region as string}</td>
                    <td className="px-4 py-3"><div className="flex gap-1">{(chain as string[]).map((p: string) => <span key={p} className="px-2 py-0.5 bg-blue-500/20 text-blue-400 rounded text-xs">{p}</span>)}</div></td>
                    <td className="px-4 py-3">{r.requires_dlt ? <AlertCircle className="w-4 h-4 text-yellow-400" /> : <span className="text-gray-500">No</span>}</td>
                    <td className="px-4 py-3 text-gray-300 font-mono text-xs">{(r.default_sender_id as string) || '—'}</td>
                    <td className="px-4 py-3 text-right"><button onClick={() => deleteMut.mutate(r.id as string)} className="text-red-400 hover:text-red-300"><Trash2 className="w-4 h-4" /></button></td>
                  </tr>
                );
              })}
              {(!data?.routes?.length) && <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-500">No region routes configured</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
