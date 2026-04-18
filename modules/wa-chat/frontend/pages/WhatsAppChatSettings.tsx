import { memo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  Settings, Shield, CheckCircle2, XCircle, ExternalLink, Eye, EyeOff,
  Copy, Trash2, Loader2, Phone, Key, Building2, Webhook, BookOpen,
  ChevronDown, ChevronRight, AlertTriangle,
} from 'lucide-react';
import toast from 'react-hot-toast';
import * as waChatApi from '../wa-chat.api';

function cn(...classes: (string | boolean | undefined | null)[]) {
  return classes.filter(Boolean).join(' ');
}

// ── Credentials Form ─────────────────────────────────────────────

function CredentialsSection() {
  const queryClient = useQueryClient();
  const [phoneNumberId, setPhoneNumberId] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [businessAccountId, setBusinessAccountId] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [editing, setEditing] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['wa-chat-credentials'],
    queryFn: waChatApi.getCredentials,
    staleTime: 30_000,
  });

  const creds = data?.credentials;
  const webhookUrl = data?.webhook_url || 'https://www.logan.com/webhook';
  const verifyToken = data?.verify_token || 'logan_verify';

  const saveMut = useMutation({
    mutationFn: () => waChatApi.saveCredentials({ phone_number_id: phoneNumberId, access_token: accessToken, business_account_id: businessAccountId || undefined, display_name: displayName || undefined }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wa-chat-credentials'] });
      toast.success('Credentials saved!');
      setEditing(false);
      setAccessToken('');
    },
    onError: () => toast.error('Failed to save credentials'),
  });

  const verifyMut = useMutation({
    mutationFn: waChatApi.verifyCredentials,
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['wa-chat-credentials'] });
      if (res.valid) toast.success('Credentials verified!');
      else toast.error('Credentials are invalid');
    },
    onError: () => toast.error('Verification failed'),
  });

  const deleteMut = useMutation({
    mutationFn: waChatApi.deleteCredentials,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wa-chat-credentials'] });
      toast.success('Credentials removed');
    },
  });

  const handleStartEdit = () => {
    setPhoneNumberId(creds?.phone_number_id || '');
    setBusinessAccountId(creds?.business_account_id || '');
    setDisplayName(creds?.display_name || '');
    setAccessToken('');
    setEditing(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!phoneNumberId.trim() || !accessToken.trim()) {
      toast.error('Phone Number ID and Access Token are required');
      return;
    }
    saveMut.mutate();
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied!`);
  };

  if (isLoading) {
    return <div className="animate-pulse h-40 rounded-xl bg-gray-200 dark:bg-gray-800" />;
  }

  return (
    <div className="space-y-6">
      {/* Status Card */}
      <div className={cn(
        'rounded-xl p-4 border flex items-center gap-3',
        creds?.is_active
          ? 'border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/30'
          : 'border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-950/30',
      )}>
        {creds?.is_active ? (
          <CheckCircle2 size={24} className="text-green-500" />
        ) : (
          <AlertTriangle size={24} className="text-yellow-500" />
        )}
        <div className="flex-1">
          <p className="font-medium text-sm">
            {creds?.is_active ? 'WhatsApp Connected' : 'WhatsApp Not Connected'}
          </p>
          <p className="text-xs text-gray-500">
            {creds?.is_active
              ? `Phone: ${creds.phone_number_id} • Last verified: ${creds.last_verified_at ? new Date(creds.last_verified_at).toLocaleString() : 'Never'}`
              : 'Add your Meta WhatsApp Business API credentials to get started'}
          </p>
        </div>
        {creds && !editing && (
          <div className="flex gap-2">
            <button
              onClick={() => verifyMut.mutate()}
              disabled={verifyMut.isPending}
              className="px-3 py-1.5 text-xs rounded-lg bg-green-500 text-white hover:bg-green-600 flex items-center gap-1"
            >
              {verifyMut.isPending ? <Loader2 size={12} className="animate-spin" /> : <Shield size={12} />}
              Verify
            </button>
            <button onClick={handleStartEdit} className="px-3 py-1.5 text-xs rounded-lg bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600">
              Edit
            </button>
            <button
              onClick={() => { if (window.confirm('Remove credentials?')) deleteMut.mutate(); }}
              className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg"
            >
              <Trash2 size={14} />
            </button>
          </div>
        )}
      </div>

      {/* Credential Form */}
      {(editing || !creds) && (
        <motion.form
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          onSubmit={handleSave}
          className="space-y-4 p-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900"
        >
          <div>
            <label className="block text-sm font-medium mb-1 flex items-center gap-1">
              <Phone size={14} /> Phone Number ID <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={phoneNumberId}
              onChange={e => setPhoneNumberId(e.target.value)}
              placeholder="e.g. 123456789012345"
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-green-500/50"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1 flex items-center gap-1">
              <Key size={14} /> Access Token <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                type={showToken ? 'text' : 'password'}
                value={accessToken}
                onChange={e => setAccessToken(e.target.value)}
                placeholder={creds?.has_access_token ? '••••••• (enter new token to update)' : 'EAAxxxxxx...'}
                className="w-full px-3 py-2 pr-10 rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-green-500/50"
                required={!creds?.has_access_token}
              />
              <button
                type="button"
                onClick={() => setShowToken(v => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showToken ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            <p className="text-xs text-gray-400 mt-1">Encrypted at rest with AES-256-GCM</p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1 flex items-center gap-1">
              <Building2 size={14} /> Business Account ID <span className="text-gray-400">(optional)</span>
            </label>
            <input
              type="text"
              value={businessAccountId}
              onChange={e => setBusinessAccountId(e.target.value)}
              placeholder="e.g. 123456789012345"
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-green-500/50"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Display Name <span className="text-gray-400">(optional)</span></label>
            <input
              type="text"
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              placeholder="My Business"
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-green-500/50"
            />
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="submit"
              disabled={saveMut.isPending}
              className="px-4 py-2 rounded-lg bg-green-500 text-white hover:bg-green-600 text-sm font-medium flex items-center gap-1"
            >
              {saveMut.isPending && <Loader2 size={14} className="animate-spin" />}
              Save Credentials
            </button>
            {editing && (
              <button type="button" onClick={() => setEditing(false)} className="px-4 py-2 rounded-lg bg-gray-200 dark:bg-gray-700 text-sm">
                Cancel
              </button>
            )}
          </div>
        </motion.form>
      )}

      {/* Webhook Info (Read-Only) */}
      <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 space-y-3">
        <h3 className="font-semibold text-sm flex items-center gap-2">
          <Webhook size={16} className="text-green-500" /> Webhook Configuration
          <span className="text-xs text-gray-400 font-normal">(read-only)</span>
        </h3>

        <div>
          <label className="block text-xs text-gray-500 mb-1">Callback URL</label>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-sm bg-gray-100 dark:bg-gray-800 px-3 py-2 rounded-lg font-mono truncate">
              {webhookUrl}
            </code>
            <button
              onClick={() => copyToClipboard(webhookUrl, 'Webhook URL')}
              className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
            >
              <Copy size={14} />
            </button>
          </div>
        </div>

        <div>
          <label className="block text-xs text-gray-500 mb-1">Verify Token</label>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-sm bg-gray-100 dark:bg-gray-800 px-3 py-2 rounded-lg font-mono">
              {verifyToken}
            </code>
            <button
              onClick={() => copyToClipboard(verifyToken, 'Verify Token')}
              className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
            >
              <Copy size={14} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── How to Connect Guide ─────────────────────────────────────────

const steps = [
  {
    title: 'Create a Meta Business Account',
    body: 'Go to business.facebook.com and create a Business account if you don\'t have one. Verify your business identity.',
    link: 'https://business.facebook.com',
  },
  {
    title: 'Set Up a Meta App',
    body: 'Go to developers.facebook.com → My Apps → Create App. Select "Business" type. Add the "WhatsApp" product to your app.',
    link: 'https://developers.facebook.com/apps',
  },
  {
    title: 'Get Your Phone Number ID',
    body: 'In your Meta App dashboard, go to WhatsApp → API Setup. You\'ll find your Phone Number ID under "From" phone number. Copy this value.',
  },
  {
    title: 'Generate a Permanent Access Token',
    body: 'In the API Setup page, click "Generate" to create a temporary token, or go to Business Settings → System Users to create a permanent token with whatsapp_business_messaging permission.',
  },
  {
    title: 'Configure the Webhook',
    body: 'In your Meta App\'s WhatsApp settings, go to Configuration → Callback URL. Enter the Webhook URL and Verify Token shown above. Subscribe to "messages" events.',
  },
  {
    title: 'Enter Credentials Above',
    body: 'Copy your Phone Number ID and Access Token into the form above and click "Save Credentials". Then click "Verify" to test the connection.',
  },
  {
    title: 'Start Chatting!',
    body: 'Once verified, incoming WhatsApp messages will appear in your Live Chat inbox. You can reply directly from the chat interface.',
  },
];

function OnboardingGuide() {
  const [expandedStep, setExpandedStep] = useState<number | null>(0);

  return (
    <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
      <h3 className="font-semibold text-sm flex items-center gap-2 mb-4">
        <BookOpen size={16} className="text-blue-500" /> How to Connect WhatsApp
      </h3>

      <div className="space-y-2">
        {steps.map((step, i) => (
          <div key={i} className="border border-gray-100 dark:border-gray-800 rounded-lg overflow-hidden">
            <button
              onClick={() => setExpandedStep(expandedStep === i ? null : i)}
              className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-gray-50 dark:hover:bg-gray-800/50"
            >
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-green-100 dark:bg-green-900/30 text-green-600 text-xs font-bold flex items-center justify-center">
                {i + 1}
              </span>
              <span className="flex-1 text-sm font-medium">{step.title}</span>
              {expandedStep === i ? <ChevronDown size={16} className="text-gray-400" /> : <ChevronRight size={16} className="text-gray-400" />}
            </button>
            {expandedStep === i && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                className="px-3 pb-3 pl-12"
              >
                <p className="text-sm text-gray-600 dark:text-gray-400">{step.body}</p>
                {step.link && (
                  <a
                    href={step.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 mt-2 text-xs text-green-600 hover:text-green-500"
                  >
                    <ExternalLink size={12} /> Open {new URL(step.link).hostname}
                  </a>
                )}
              </motion.div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main Settings Page ───────────────────────────────────────────

function WhatsAppChatSettings() {
  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
          <Settings size={20} className="text-green-500" />
        </div>
        <div>
          <h1 className="text-xl font-bold">WhatsApp Chat Settings</h1>
          <p className="text-sm text-gray-500">Manage your WhatsApp Business API connection</p>
        </div>
      </div>

      <CredentialsSection />
      <OnboardingGuide />
    </div>
  );
}

export default memo(WhatsAppChatSettings);
