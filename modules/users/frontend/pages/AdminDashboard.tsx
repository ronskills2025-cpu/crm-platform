import { FormEvent, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  AlertTriangle,
  CheckCircle2,
  PauseCircle,
  PlayCircle,
  RefreshCw,
  Save,
  Send,
  Trash2,
  Webhook,
} from 'lucide-react';
import { adminApi } from '../../../../packages/ui/src/services/api';

type Channel = 'whatsapp' | 'sms' | 'email';
type ProviderStatus = 'connected' | 'failed' | 'unchecked' | 'paused';

interface ProviderRecord {
  id: string;
  channel: Channel;
  name: string;
  display_name: string | null;
  is_active: boolean;
  priority: number;
  rate_per_sec: number;
  cost_per_msg: number;
  daily_limit: number;
  credentials: Record<string, unknown>;
  status: ProviderStatus;
  status_message: string | null;
  last_validated_at: string | null;
}

interface CampaignErrorRecord {
  id: string;
  campaign_id: string;
  channel: Channel;
  recipient: string;
  provider: string | null;
  error_message: string;
  created_at: string;
}

interface FormState {
  name: string;
  display_name: string;
  priority: number;
  rate_per_sec: number;
  cost_per_msg: number;
  daily_limit: number;
  is_active: boolean;

  // WhatsApp
  phoneNumberId: string;
  accessToken: string;
  apiVersion: string;
  webhookUrl: string;
  verifyToken: string;

  // SMS
  providerType: string;
  apiKey: string;
  authKey: string;
  senderId: string;
  sender: string;
  region: string;
  apiUrl: string;

  // Email
  fromEmail: string;
  fromName: string;
  host: string;
  port: number;
  user: string;
  pass: string;
  secure: boolean;
}

const DEFAULT_VERIFY_TOKEN = 'billy777_verify';
const DEFAULT_WEBHOOK_URL = 'https://mobsforsub.com/webhook';

const channelLabel: Record<Channel, string> = {
  whatsapp: 'WhatsApp Cloud API',
  sms: 'SMS Providers',
  email: 'Email / SMTP',
};

const defaultsByChannel: Record<Channel, FormState> = {
  whatsapp: {
    name: 'meta',
    display_name: 'Meta Primary',
    priority: 10,
    rate_per_sec: 80,
    cost_per_msg: 0,
    daily_limit: 0,
    is_active: true,
    phoneNumberId: '',
    accessToken: '',
    apiVersion: 'v21.0',
    webhookUrl: DEFAULT_WEBHOOK_URL,
    verifyToken: DEFAULT_VERIFY_TOKEN,
    providerType: 'fast2sms',
    apiKey: '',
    authKey: '',
    senderId: '',
    sender: '',
    region: 'IN',
    apiUrl: '',
    fromEmail: '',
    fromName: '',
    host: 'smtp.gmail.com',
    port: 587,
    user: '',
    pass: '',
    secure: false,
  },
  sms: {
    name: 'fast2sms',
    display_name: 'Fast2SMS',
    priority: 10,
    rate_per_sec: 50,
    cost_per_msg: 0,
    daily_limit: 0,
    is_active: true,
    phoneNumberId: '',
    accessToken: '',
    apiVersion: 'v21.0',
    webhookUrl: '',
    verifyToken: '',
    providerType: 'fast2sms',
    apiKey: '',
    authKey: '',
    senderId: '',
    sender: '',
    region: 'IN',
    apiUrl: '',
    fromEmail: '',
    fromName: '',
    host: 'smtp.gmail.com',
    port: 587,
    user: '',
    pass: '',
    secure: false,
  },
  email: {
    name: 'smtp_primary',
    display_name: 'SMTP Primary',
    priority: 10,
    rate_per_sec: 14,
    cost_per_msg: 0,
    daily_limit: 0,
    is_active: true,
    phoneNumberId: '',
    accessToken: '',
    apiVersion: 'v21.0',
    webhookUrl: '',
    verifyToken: '',
    providerType: 'smtp',
    apiKey: '',
    authKey: '',
    senderId: '',
    sender: '',
    region: 'IN',
    apiUrl: '',
    fromEmail: '',
    fromName: '',
    host: 'smtp.gmail.com',
    port: 587,
    user: '',
    pass: '',
    secure: false,
  },
};

function toInput(value: unknown, keepMasked = false): string {
  if (typeof value !== 'string') return '';
  if (!keepMasked && value.includes('***')) return '';
  return value;
}

function compact(record: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(record).filter(([, value]) => value !== '' && value !== undefined && value !== null)
  );
}

function statusClass(status: ProviderStatus): string {
  if (status === 'connected') return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
  if (status === 'failed') return 'bg-red-500/10 text-red-400 border-red-500/20';
  if (status === 'paused') return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20';
  return 'bg-gray-500/10 text-gray-300 border-gray-500/20';
}

function fieldClass() {
  return 'w-full rounded-lg bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-gray-100';
}

export default function AdminDashboard() {
  const queryClient = useQueryClient();
  const [channel, setChannel] = useState<Channel>('whatsapp');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<FormState>(defaultsByChannel.whatsapp);

  const { data: providersData, isLoading: providersLoading } = useQuery({
    queryKey: ['admin-providers', channel],
    queryFn: () => adminApi.listProviders(channel),
    refetchInterval: 30_000,
  });

  const { data: errorsData } = useQuery({
    queryKey: ['campaign-errors', channel],
    queryFn: () => adminApi.getCampaignErrors({ channel, resolved: 'false', limit: '50' }),
    refetchInterval: 30_000,
  });

  const providers = (providersData?.providers ?? []) as ProviderRecord[];
  const campaignErrors = (errorsData?.errors ?? []) as CampaignErrorRecord[];

  const groupedErrors = useMemo(() => {
    const seen = new Set<string>();
    return campaignErrors.filter((item) => {
      if (seen.has(item.campaign_id)) return false;
      seen.add(item.campaign_id);
      return true;
    });
  }, [campaignErrors]);

  async function refreshAll() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['admin-providers'] }),
      queryClient.invalidateQueries({ queryKey: ['provider-health'] }),
      queryClient.invalidateQueries({ queryKey: ['campaign-errors'] }),
      queryClient.invalidateQueries({ queryKey: ['global-stats'] }),
    ]);
  }

  function resetForm(nextChannel = channel) {
    setEditingId(null);
    setForm(defaultsByChannel[nextChannel]);
  }

  function changeChannel(next: Channel) {
    setChannel(next);
    resetForm(next);
  }

  function loadProvider(provider: ProviderRecord) {
    const c = provider.credentials || {};
    setEditingId(provider.id);
    setForm((prev) => ({
      ...prev,
      name: provider.name,
      display_name: provider.display_name || provider.name,
      priority: provider.priority,
      rate_per_sec: provider.rate_per_sec,
      cost_per_msg: Number(provider.cost_per_msg || 0),
      daily_limit: provider.daily_limit,
      is_active: provider.is_active,
      phoneNumberId: toInput(c.phoneNumberId),
      accessToken: '',
      apiVersion: toInput(c.apiVersion, true) || 'v21.0',
      webhookUrl: toInput(c.webhookUrl, true) || DEFAULT_WEBHOOK_URL,
      verifyToken: toInput(c.verifyToken) || DEFAULT_VERIFY_TOKEN,
      providerType: toInput(c.provider, true) || provider.name,
      apiKey: '',
      authKey: '',
      senderId: toInput(c.senderId, true),
      sender: toInput(c.sender, true),
      region: toInput(c.region, true) || 'IN',
      apiUrl: toInput(c.apiUrl, true),
      fromEmail: toInput(c.fromEmail, true),
      fromName: toInput(c.fromName, true),
      host: toInput(c.host, true) || 'smtp.gmail.com',
      port: Number(c.port || 587),
      user: toInput(c.user, true),
      pass: '',
      secure: Boolean(c.secure),
    }));
  }

  function buildPayload() {
    const base = {
      channel,
      name: form.name.trim(),
      display_name: form.display_name.trim(),
      priority: Number(form.priority),
      rate_per_sec: Number(form.rate_per_sec),
      cost_per_msg: Number(form.cost_per_msg),
      daily_limit: Number(form.daily_limit),
      is_active: form.is_active,
    };

    if (channel === 'whatsapp') {
      return {
        ...base,
        credentials: compact({
          phoneNumberId: form.phoneNumberId.trim(),
          accessToken: form.accessToken.trim(),
          apiVersion: form.apiVersion.trim() || 'v21.0',
          webhookUrl: DEFAULT_WEBHOOK_URL,
          verifyToken: DEFAULT_VERIFY_TOKEN,
        }),
      };
    }

    if (channel === 'sms') {
      return {
        ...base,
        credentials: compact({
          provider: form.providerType,
          apiKey: form.apiKey.trim(),
          authKey: form.authKey.trim(),
          senderId: form.senderId.trim(),
          sender: form.sender.trim(),
          region: form.region.trim(),
          apiUrl: form.apiUrl.trim(),
        }),
      };
    }

    return {
      ...base,
      credentials: compact({
        provider: form.providerType,
        apiKey: form.apiKey.trim(),
        fromEmail: form.fromEmail.trim(),
        fromName: form.fromName.trim(),
        host: form.host.trim(),
        port: Number(form.port),
        user: form.user.trim(),
        pass: form.pass.trim(),
        secure: form.secure,
      }),
    };
  }

  async function submitProvider(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      setSaving(true);
      const payload = buildPayload();
      if (editingId) {
        await adminApi.updateProvider(editingId, payload);
        toast.success('Configuration updated');
      } else {
        await adminApi.createProvider(payload);
        toast.success('Configuration saved');
      }
      resetForm();
      await refreshAll();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function validateProvider(id: string) {
    try {
      const result = await adminApi.validateProvider(id);
      toast.success(result.message || 'Validated');
      await refreshAll();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Validation failed');
    }
  }

  async function testProvider(provider: ProviderRecord) {
    const to = window.prompt(channel === 'email' ? 'Test email address' : 'Test phone number', '');
    if (!to) return;
    try {
      const result = await adminApi.testProvider(provider.id, {
        to,
        message: 'Test message from CRM admin panel',
        subject: 'SMTP/API test from CRM admin panel',
      });
      if (result.success) {
        toast.success('Test successful');
      } else {
        toast.error(result.error || 'Test failed');
      }
      await refreshAll();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Test failed');
    }
  }

  async function togglePause(provider: ProviderRecord) {
    try {
      if (provider.status === 'paused') {
        await adminApi.resumeProvider(provider.id);
        toast.success('Provider resumed');
      } else {
        await adminApi.pauseProvider(provider.id);
        toast.success('Provider paused');
      }
      await refreshAll();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Update failed');
    }
  }

  async function deleteProvider(id: string) {
    if (!window.confirm('Delete this provider config?')) return;
    try {
      await adminApi.deleteProvider(id);
      toast.success('Deleted');
      if (editingId === id) resetForm();
      await refreshAll();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Delete failed');
    }
  }

  async function registerWebhook(provider: ProviderRecord) {
    try {
      const result = await adminApi.registerWebhook(provider.id, {
        webhookUrl: DEFAULT_WEBHOOK_URL,
        verifyToken: DEFAULT_VERIFY_TOKEN,
      });
      if (result.success) {
        toast.success('Webhook registered');
      } else {
        toast.error(result.error || 'Webhook registration failed');
      }
      await refreshAll();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Webhook registration failed');
    }
  }

  async function retryCampaign(campaignId: string) {
    try {
      const result = await adminApi.retryCampaign(campaignId);
      toast.success(`Requeued ${result.requeued || 0} messages`);
      await refreshAll();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Retry failed');
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Channel Configuration</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Configure WhatsApp, SMS, and Email directly from admin panel.</p>
        </div>
        <button onClick={refreshAll} className="px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 inline-flex items-center gap-2">
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      <div className="flex gap-2 flex-wrap">
        {(['whatsapp', 'sms', 'email'] as Channel[]).map((item) => (
          <button
            key={item}
            onClick={() => changeChannel(item)}
            className={`px-3 py-2 rounded-lg text-sm border ${channel === item ? 'border-brand-500 bg-brand-500/10 text-brand-600 dark:text-brand-300' : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-300'}`}
          >
            {channelLabel[item]}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[430px_minmax(0,1fr)] gap-6">
        <form onSubmit={submitProvider} className="card border border-gray-200 dark:border-gray-800 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">{editingId ? 'Edit Configuration' : `New ${channelLabel[channel]} Config`}</h2>
            {editingId && <button type="button" onClick={() => resetForm()} className="text-sm text-gray-400">Cancel</button>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="text-sm space-y-1 col-span-1"><span>Name</span><input className={fieldClass()} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} disabled={Boolean(editingId)} /></label>
            <label className="text-sm space-y-1 col-span-1"><span>Display name</span><input className={fieldClass()} value={form.display_name} onChange={(e) => setForm({ ...form, display_name: e.target.value })} /></label>
            <label className="text-sm space-y-1"><span>Priority</span><input type="number" className={fieldClass()} value={form.priority} onChange={(e) => setForm({ ...form, priority: Number(e.target.value) })} /></label>
            <label className="text-sm space-y-1"><span>Rate/sec</span><input type="number" className={fieldClass()} value={form.rate_per_sec} onChange={(e) => setForm({ ...form, rate_per_sec: Number(e.target.value) })} /></label>
          </div>

          {channel === 'whatsapp' && (
            <div className="space-y-3 border-t border-gray-200 dark:border-gray-800 pt-4">
              <label className="text-sm space-y-1 block"><span>Phone Number ID</span><input className={fieldClass()} value={form.phoneNumberId} onChange={(e) => setForm({ ...form, phoneNumberId: e.target.value })} /></label>
              <label className="text-sm space-y-1 block"><span>Access Token</span><input type="password" placeholder={editingId ? 'Leave blank to keep existing token' : ''} className={fieldClass()} value={form.accessToken} onChange={(e) => setForm({ ...form, accessToken: e.target.value })} /></label>
              <label className="text-sm space-y-1 block"><span>API Version</span><input className={fieldClass()} value={form.apiVersion} onChange={(e) => setForm({ ...form, apiVersion: e.target.value })} /></label>

              <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-3 space-y-2">
                <p className="text-sm font-medium text-cyan-600 dark:text-cyan-300">Fixed WhatsApp Webhook Settings</p>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Webhook URL</p>
                  <code className="block mt-1 rounded bg-gray-100 dark:bg-gray-950 px-2 py-1 text-xs text-cyan-700 dark:text-cyan-200 break-all">{DEFAULT_WEBHOOK_URL}</code>
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Verify Token</p>
                  <code className="block mt-1 rounded bg-gray-100 dark:bg-gray-950 px-2 py-1 text-xs text-cyan-700 dark:text-cyan-200 break-all">{DEFAULT_VERIFY_TOKEN}</code>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400">These two values are fixed and used automatically when saving or registering the webhook.</p>
              </div>
            </div>
          )}

          {channel === 'sms' && (
            <div className="space-y-3 border-t border-gray-200 dark:border-gray-800 pt-4">
              <label className="text-sm space-y-1 block">
                <span>SMS Provider</span>
                <select className={fieldClass()} value={form.providerType} onChange={(e) => setForm({ ...form, providerType: e.target.value })}>
                  <option value="fast2sms">Fast2SMS</option>
                  <option value="msg91">MSG91</option>
                  <option value="textlocal">TextLocal</option>
                  <option value="custom">Custom</option>
                </select>
              </label>
              <label className="text-sm space-y-1 block"><span>API Key</span><input type="password" placeholder={editingId ? 'Leave blank to keep existing key' : ''} className={fieldClass()} value={form.apiKey} onChange={(e) => setForm({ ...form, apiKey: e.target.value })} /></label>
              <label className="text-sm space-y-1 block"><span>Auth Token (if provider needs it)</span><input type="password" placeholder={editingId ? 'Leave blank to keep existing token' : ''} className={fieldClass()} value={form.authKey} onChange={(e) => setForm({ ...form, authKey: e.target.value })} /></label>
              <label className="text-sm space-y-1 block"><span>Sender ID</span><input className={fieldClass()} value={form.senderId} onChange={(e) => setForm({ ...form, senderId: e.target.value })} /></label>
              <label className="text-sm space-y-1 block"><span>Region</span><input className={fieldClass()} value={form.region} onChange={(e) => setForm({ ...form, region: e.target.value })} /></label>
              {form.providerType === 'custom' && (
                <label className="text-sm space-y-1 block"><span>Custom API URL</span><input className={fieldClass()} value={form.apiUrl} onChange={(e) => setForm({ ...form, apiUrl: e.target.value })} /></label>
              )}
            </div>
          )}

          {channel === 'email' && (
            <div className="space-y-3 border-t border-gray-200 dark:border-gray-800 pt-4">
              <label className="text-sm space-y-1 block">
                <span>Email Provider</span>
                <select className={fieldClass()} value={form.providerType} onChange={(e) => setForm({ ...form, providerType: e.target.value })}>
                  <option value="smtp">SMTP</option>
                  <option value="resend">Resend API</option>
                  <option value="sendgrid">SendGrid API</option>
                </select>
              </label>
              <label className="text-sm space-y-1 block"><span>From Email</span><input className={fieldClass()} value={form.fromEmail} onChange={(e) => setForm({ ...form, fromEmail: e.target.value })} /></label>
              {form.providerType === 'smtp' ? (
                <>
                  <label className="text-sm space-y-1 block"><span>SMTP Host</span><input className={fieldClass()} value={form.host} onChange={(e) => setForm({ ...form, host: e.target.value })} /></label>
                  <div className="grid grid-cols-2 gap-3">
                    <label className="text-sm space-y-1"><span>SMTP Port</span><input type="number" className={fieldClass()} value={form.port} onChange={(e) => setForm({ ...form, port: Number(e.target.value) })} /></label>
                    <label className="text-sm space-y-1"><span>User</span><input className={fieldClass()} value={form.user} onChange={(e) => setForm({ ...form, user: e.target.value })} /></label>
                  </div>
                  <label className="text-sm space-y-1 block"><span>Password</span><input type="password" placeholder={editingId ? 'Leave blank to keep existing password' : ''} className={fieldClass()} value={form.pass} onChange={(e) => setForm({ ...form, pass: e.target.value })} /></label>
                </>
              ) : (
                <label className="text-sm space-y-1 block"><span>API Key</span><input type="password" placeholder={editingId ? 'Leave blank to keep existing key' : ''} className={fieldClass()} value={form.apiKey} onChange={(e) => setForm({ ...form, apiKey: e.target.value })} /></label>
              )}
            </div>
          )}

          <label className="text-sm flex items-center gap-2"><input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} /> Active</label>

          <button disabled={saving} className="w-full rounded-lg bg-brand-600 hover:bg-brand-500 disabled:opacity-60 px-4 py-2.5 font-medium inline-flex items-center justify-center gap-2">
            <Save className="w-4 h-4" /> {saving ? 'Saving...' : editingId ? 'Update Configuration' : 'Save Configuration'}
          </button>
        </form>

        <div className="card border border-gray-200 dark:border-gray-800 space-y-4">
          <h2 className="text-lg font-semibold">Saved Configurations ({channelLabel[channel]})</h2>

          {providersLoading ? (
            <p className="text-gray-500 dark:text-gray-400">Loading...</p>
          ) : providers.length === 0 ? (
            <p className="text-gray-500 dark:text-gray-400">No saved configuration for this channel yet.</p>
          ) : (
            <div className="space-y-3">
              {providers.map((provider) => (
                <div key={provider.id} className="rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/60 p-4">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div>
                      <p className="font-semibold">{provider.display_name || provider.name}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">Priority {provider.priority} | Rate {provider.rate_per_sec}/sec</p>
                      <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{provider.status_message || 'No validation message yet'}</p>
                    </div>
                    <span className={`px-2 py-1 rounded-full text-xs border ${statusClass(provider.status)}`}>{provider.status}</span>
                  </div>

                  <div className="flex gap-2 flex-wrap mt-3">
                    <button onClick={() => loadProvider(provider)} className="px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 text-sm">Edit</button>
                    <button onClick={() => validateProvider(provider.id)} className="px-3 py-1.5 rounded-lg bg-emerald-600/15 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-600/25 text-sm inline-flex items-center gap-1"><CheckCircle2 className="w-4 h-4" /> Validate</button>
                    <button onClick={() => testProvider(provider)} className="px-3 py-1.5 rounded-lg bg-brand-600/15 text-brand-700 dark:text-brand-300 hover:bg-brand-600/25 text-sm inline-flex items-center gap-1"><Send className="w-4 h-4" /> Test</button>
                    {channel === 'whatsapp' && (
                      <button onClick={() => registerWebhook(provider)} className="px-3 py-1.5 rounded-lg bg-cyan-600/15 text-cyan-700 dark:text-cyan-300 hover:bg-cyan-600/25 text-sm inline-flex items-center gap-1"><Webhook className="w-4 h-4" /> Register Fixed Webhook</button>
                    )}
                    <button onClick={() => togglePause(provider)} className="px-3 py-1.5 rounded-lg bg-yellow-600/15 text-yellow-700 dark:text-yellow-300 hover:bg-yellow-600/25 text-sm inline-flex items-center gap-1">
                      {provider.status === 'paused' ? <PlayCircle className="w-4 h-4" /> : <PauseCircle className="w-4 h-4" />}
                      {provider.status === 'paused' ? 'Resume' : 'Pause'}
                    </button>
                    <button onClick={() => deleteProvider(provider.id)} className="px-3 py-1.5 rounded-lg bg-red-600/15 text-red-700 dark:text-red-300 hover:bg-red-600/25 text-sm inline-flex items-center gap-1"><Trash2 className="w-4 h-4" /> Delete</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="card border border-gray-200 dark:border-gray-800">
        <div className="flex items-center gap-2 mb-3">
          <AlertTriangle className="w-5 h-5 text-yellow-400" />
          <h2 className="text-lg font-semibold">Failed Campaign Recovery ({channel.toUpperCase()})</h2>
        </div>

        {groupedErrors.length === 0 ? (
          <p className="text-gray-500 dark:text-gray-400">No unresolved campaign errors for this channel.</p>
        ) : (
          <div className="space-y-3">
            {groupedErrors.map((item) => (
              <div key={item.id} className="rounded-xl border border-red-500/20 bg-red-500/5 p-4 flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <p className="font-semibold">Campaign {item.campaign_id}</p>
                  <p className="text-sm text-gray-700 dark:text-gray-200 mt-1">{item.error_message}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Recipient: {item.recipient} | Provider: {item.provider || 'n/a'}</p>
                </div>
                <button onClick={() => retryCampaign(item.campaign_id)} className="px-3 py-2 rounded-lg bg-brand-600 hover:bg-brand-500 text-sm">Retry & Resume</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
