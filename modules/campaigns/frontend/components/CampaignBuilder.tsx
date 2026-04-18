import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useDropzone } from 'react-dropzone';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { MessageSquare, Smartphone, Mail, Upload, FileText, Send, Calendar, ChevronRight, ChevronLeft, Star } from 'lucide-react';
import { campaignApi, whatsappApi, smsApi, emailApi } from '../../../../packages/ui/src/services/api';
import { cn } from '../../../../packages/utils/src/frontend-utils';
import toast from 'react-hot-toast';

type Channel = 'whatsapp' | 'sms' | 'email';

interface Contact {
  phone?: string;
  email?: string;
  name?: string;
  params?: Record<string, string>;
}

const steps = ['Channel', 'Contacts', 'Message', 'Providers', 'Review & Send'];

export function CampaignBuilder() {
  const [step, setStep] = useState(0);
  const [channel, setChannel] = useState<Channel>('whatsapp');
  const [campaignName, setCampaignName] = useState('');
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [messageBody, setMessageBody] = useState('');
  const [subject, setSubject] = useState('');
  const [templateId, setTemplateId] = useState('');
  const [senderId, setSenderId] = useState('');
  const [dltTemplateId, setDltTemplateId] = useState('');
  const [useDlt, setUseDlt] = useState(false);
  const [virtualNumberId, setVirtualNumberId] = useState('');
  const [providers, setProviders] = useState<string[]>([]);
  const [priority, setPriority] = useState(0);
  const [scheduleAt, setScheduleAt] = useState('');
  const queryClient = useQueryClient();

  const createCampaignMutation = useMutation({
    mutationFn: async () => {
      // 1. Create campaign
      const campaign = await campaignApi.create({
        name: campaignName,
        channel,
        message_body: messageBody,
        subject: channel === 'email' ? subject : undefined,
        template_id: templateId || undefined,
        provider_chain: providers.length > 0 ? providers : undefined,
        priority,
        scheduled_at: scheduleAt || undefined,
      });

      // 2. Send batch
      const campaignId = campaign.campaign.id;
      switch (channel) {
        case 'whatsapp':
          return whatsappApi.sendBatch({
            campaign_id: campaignId,
            contacts: contacts.map((c) => ({ phone: c.phone!, params: c.params })),
            message: messageBody,
            template_id: templateId || undefined,
            provider_chain: providers.length > 0 ? providers : undefined,
          });
        case 'sms':
          return smsApi.sendBatch({
            campaign_id: campaignId,
            contacts: contacts.map((c) => ({ phone: c.phone! })),
            message: messageBody,
            sender_id: senderId || undefined,
            dlt_template_id: useDlt ? (dltTemplateId || undefined) : undefined,
            provider_chain: providers.length > 0 ? providers : undefined,
            use_dlt: useDlt,
            virtual_number_id: !useDlt && virtualNumberId ? virtualNumberId : undefined,
          });
        case 'email':
          return emailApi.sendBatch({
            campaign_id: campaignId,
            contacts: contacts.map((c) => ({ email: c.email!, name: c.name })),
            subject,
            html_body: messageBody,
            provider_chain: providers.length > 0 ? providers : undefined,
          });
      }
    },
    onSuccess: () => {
      toast.success(`Campaign "${campaignName}" launched!`);
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      queryClient.invalidateQueries({ queryKey: ['global-stats'] });
      // Reset form
      setStep(0);
      setCampaignName('');
      setContacts([]);
      setMessageBody('');
      setSubject('');
    },
    onError: (err: Error) => {
      toast.error(`Failed to launch campaign: ${err.message}`);
    },
  });

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const lines = text.split('\n').filter((l) => l.trim());
      const header = lines[0].toLowerCase().split(',').map((h) => h.trim());
      const parsed: Contact[] = [];

      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map((v) => v.trim());
        const contact: Contact = {};

        header.forEach((h, idx) => {
          if (h === 'phone' || h === 'mobile' || h === 'number') contact.phone = values[idx];
          else if (h === 'email' || h === 'mail') contact.email = values[idx];
          else if (h === 'name') contact.name = values[idx];
        });

        if (contact.phone || contact.email) parsed.push(contact);
      }

      setContacts(parsed);
      toast.success(`Loaded ${parsed.length} contacts`);
    };
    reader.readAsText(file);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'text/csv': ['.csv'] },
    maxFiles: 1,
  });

  const channelProviders: Record<Channel, string[]> = {
    whatsapp: ['api1', 'api2', 'api3'],
    sms: ['self', 'fast2sms', 'msg91', 'textlocal', 'twilio', 'aws_sns', 'custom'],
    email: ['resend', 'sendgrid', 'smtp'],
  };

  const channelIcons: Record<Channel, typeof MessageSquare> = {
    whatsapp: MessageSquare,
    sms: Smartphone,
    email: Mail,
  };

  const channelColors: Record<Channel, string> = {
    whatsapp: 'border-whatsapp bg-whatsapp/10 text-whatsapp',
    sms: 'border-sms bg-sms/10 text-sms',
    email: 'border-email bg-email/10 text-email',
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Campaign Builder</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">Create and launch messaging campaigns</p>
      </div>

      {/* Step Indicator */}
      <div className="flex items-center gap-2">
        {steps.map((s, i) => (
          <div key={s} className="flex items-center">
            <button
              onClick={() => i < step && setStep(i)}
              className={cn(
                'flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all',
                i === step ? 'bg-brand-600 text-white' :
                i < step ? 'bg-brand-600/20 text-brand-400 cursor-pointer' :
                'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
              )}
            >
              <span className="w-5 h-5 rounded-full border flex items-center justify-center text-xs">
                {i < step ? '✓' : i + 1}
              </span>
              <span className="hidden sm:inline">{s}</span>
            </button>
            {i < steps.length - 1 && <ChevronRight className="w-4 h-4 text-gray-400 dark:text-gray-600 mx-1" />}
          </div>
        ))}
      </div>

      {/* Step Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          className="card"
        >
          {/* Step 0: Channel Selection */}
          {step === 0 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold">Select Channel</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {(['whatsapp', 'sms', 'email'] as Channel[]).map((ch) => {
                  const Icon = channelIcons[ch];
                  return (
                    <button
                      key={ch}
                      onClick={() => { setChannel(ch); setProviders([]); }}
                      className={cn(
                        'p-6 rounded-xl border-2 transition-all text-left',
                        channel === ch ? channelColors[ch] : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                      )}
                    >
                      <Icon className="w-8 h-8 mb-3" />
                      <h3 className="font-semibold text-lg capitalize">{ch}</h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        {ch === 'whatsapp' && 'Meta Business API with templates'}
                        {ch === 'sms' && 'SMS with DLT & non-DLT mode support'}
                        {ch === 'email' && 'HTML emails with tracking'}
                      </p>
                    </button>
                  );
                })}
              </div>
              <div>
                <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Campaign Name</label>
                <input
                  className="input w-full"
                  placeholder="e.g., March Sale Announcement"
                  value={campaignName}
                  onChange={(e) => setCampaignName(e.target.value)}
                />
              </div>
            </div>
          )}

          {/* Step 1: Upload Contacts */}
          {step === 1 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold">Upload Contacts</h2>
              <div
                {...getRootProps()}
                className={cn(
                  'border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-all',
                  isDragActive ? 'border-brand-500 bg-brand-500/10' : 'border-gray-300 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-600'
                )}
              >
                <input {...getInputProps()} />
                <Upload className="w-12 h-12 text-gray-500 dark:text-gray-400 mx-auto mb-4" />
                <p className="text-gray-700 dark:text-gray-300 font-medium">
                  {isDragActive ? 'Drop your CSV here...' : 'Drag & drop a CSV file, or click to browse'}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                  CSV with columns: {channel === 'email' ? 'email, name' : 'phone, name'}
                </p>
              </div>

              {contacts.length > 0 && (
                <div className="mt-4">
                  <div className="flex items-center gap-2 mb-2">
                    <FileText className="w-4 h-4 text-brand-400" />
                    <span className="font-medium">{contacts.length} contacts loaded</span>
                  </div>
                  <div className="max-h-48 overflow-y-auto rounded-lg bg-gray-100 dark:bg-gray-800/50 p-3">
                    {contacts.slice(0, 10).map((c, i) => (
                      <div key={i} className="text-sm text-gray-700 dark:text-gray-400 py-1">
                        {c.phone || c.email} {c.name && `(${c.name})`}
                      </div>
                    ))}
                    {contacts.length > 10 && (
                      <div className="text-sm text-gray-500 py-1">...and {contacts.length - 10} more</div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step 2: Message */}
          {step === 2 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold">Create Message</h2>

              {channel === 'email' && (
                <div>
                  <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Subject</label>
                  <input
                    className="input w-full"
                    placeholder="Email subject line"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                  />
                </div>
              )}

              {channel === 'whatsapp' && (
                <div>
                  <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Template ID (optional)</label>
                  <input
                    className="input w-full"
                    placeholder="Meta template name"
                    value={templateId}
                    onChange={(e) => setTemplateId(e.target.value)}
                  />
                </div>
              )}

              {channel === 'sms' && (
                <div className="space-y-4">
                  {/* DLT Mode Toggle */}
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-gray-100 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700">
                    <button
                      onClick={() => setUseDlt(!useDlt)}
                      className={cn(
                        'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
                        useDlt ? 'bg-brand-600' : 'bg-gray-300 dark:bg-gray-600'
                      )}
                    >
                      <span className={cn(
                        'inline-block h-4 w-4 rounded-full bg-white transition-transform',
                        useDlt ? 'translate-x-6' : 'translate-x-1'
                      )} />
                    </button>
                    <div>
                      <p className="text-sm font-medium">{useDlt ? 'DLT Mode (Official)' : 'Non-DLT Mode (Unofficial)'}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {useDlt
                          ? 'Send using registered DLT entity & template — required for official transactional/promotional SMS in India'
                          : 'Send without DLT registration — use virtual numbers for unofficial sending'}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
                        {useDlt ? 'Sender ID (Registered)' : 'Sender ID / Virtual Number'}
                      </label>
                      <input
                        className="input w-full"
                        placeholder={useDlt ? '6-char registered sender' : 'Phone number or sender'}
                        maxLength={useDlt ? 6 : 20}
                        value={senderId}
                        onChange={(e) => setSenderId(e.target.value)}
                      />
                    </div>
                    {useDlt ? (
                      <div>
                        <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">DLT Template ID</label>
                        <input
                          className="input w-full"
                          placeholder="DLT template ID"
                          value={dltTemplateId}
                          onChange={(e) => setDltTemplateId(e.target.value)}
                        />
                      </div>
                    ) : (
                      <div>
                        <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Virtual Number ID (optional)</label>
                        <input
                          className="input w-full"
                          placeholder="Auto-pick if empty"
                          value={virtualNumberId}
                          onChange={(e) => setVirtualNumberId(e.target.value)}
                        />
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
                  {channel === 'email' ? 'HTML Body' : 'Message'}
                </label>
                <textarea
                  className="input w-full h-40 resize-none"
                  placeholder={channel === 'email' ? '<h1>Your HTML email content</h1>' : 'Type your message...'}
                  value={messageBody}
                  onChange={(e) => setMessageBody(e.target.value)}
                />
                {channel === 'sms' && (
                  <p className="text-xs text-gray-500 mt-1">{messageBody.length}/160 characters</p>
                )}
              </div>
            </div>
          )}

          {/* Step 3: Providers */}
          {step === 3 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold">Choose Providers (Failover Order)</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">Select providers in priority order. Messages fail over to the next provider automatically.</p>

              <div className="space-y-2">
                {channelProviders[channel].map((p) => (
                  <button
                    key={p}
                    onClick={() => {
                      setProviders((prev) =>
                        prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]
                      );
                    }}
                    className={cn(
                      'w-full flex items-center justify-between p-4 rounded-lg border transition-all',
                        providers.includes(p) ? 'border-brand-500 bg-brand-500/10' : 'border-gray-300 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-600'
                    )}
                  >
                    <span className="font-medium capitalize">{p}</span>
                    {providers.includes(p) && (
                      <span className="badge-info">#{providers.indexOf(p) + 1}</span>
                    )}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-4 mt-4">
                <div>
                  <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Priority (0-10)</label>
                  <input
                    type="number"
                    className="input w-full"
                    min={0}
                    max={10}
                    value={priority}
                    onChange={(e) => setPriority(parseInt(e.target.value) || 0)}
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Schedule (optional)</label>
                  <input
                    type="datetime-local"
                    className="input w-full"
                    value={scheduleAt}
                    onChange={(e) => setScheduleAt(e.target.value)}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Step 4: Review */}
          {step === 4 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold">Review & Launch</h2>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-lg bg-gray-100 dark:bg-gray-800/50">
                  <p className="text-sm text-gray-600 dark:text-gray-400">Campaign</p>
                  <p className="font-medium">{campaignName || 'Untitled'}</p>
                </div>
                <div className="p-4 rounded-lg bg-gray-100 dark:bg-gray-800/50">
                  <p className="text-sm text-gray-600 dark:text-gray-400">Channel</p>
                  <p className="font-medium capitalize">{channel}</p>
                </div>
                <div className="p-4 rounded-lg bg-gray-100 dark:bg-gray-800/50">
                  <p className="text-sm text-gray-600 dark:text-gray-400">Contacts</p>
                  <p className="font-medium">{contacts.length}</p>
                </div>
                <div className="p-4 rounded-lg bg-gray-100 dark:bg-gray-800/50">
                  <p className="text-sm text-gray-600 dark:text-gray-400">Providers</p>
                  <p className="font-medium">{providers.length > 0 ? providers.join(' → ') : 'Auto'}</p>
                </div>
                {channel === 'sms' && (
                  <div className="p-4 rounded-lg bg-gray-100 dark:bg-gray-800/50">
                    <p className="text-sm text-gray-600 dark:text-gray-400">SMS Mode</p>
                    <p className="font-medium">{useDlt ? 'DLT (Official)' : 'Non-DLT (Unofficial)'}</p>
                  </div>
                )}
                {priority > 0 && (
                  <div className="p-4 rounded-lg bg-gray-100 dark:bg-gray-800/50">
                    <p className="text-sm text-gray-600 dark:text-gray-400">Priority</p>
                    <p className="font-medium flex items-center gap-1"><Star className="w-4 h-4 text-yellow-400" /> {priority}</p>
                  </div>
                )}
                {scheduleAt && (
                  <div className="p-4 rounded-lg bg-gray-100 dark:bg-gray-800/50">
                    <p className="text-sm text-gray-600 dark:text-gray-400">Scheduled</p>
                    <p className="font-medium flex items-center gap-1"><Calendar className="w-4 h-4" /> {new Date(scheduleAt).toLocaleString()}</p>
                  </div>
                )}
              </div>

              <div className="p-4 rounded-lg bg-gray-100 dark:bg-gray-800/50">
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Message Preview</p>
                <p className="text-sm whitespace-pre-wrap">{messageBody.substring(0, 200)}{messageBody.length > 200 ? '...' : ''}</p>
              </div>
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          disabled={step === 0}
          className="btn-secondary flex items-center gap-2 disabled:opacity-50"
        >
          <ChevronLeft className="w-4 h-4" /> Back
        </button>

        {step < steps.length - 1 ? (
          <button
            onClick={() => setStep((s) => s + 1)}
            disabled={
              (step === 0 && !campaignName) ||
              (step === 1 && contacts.length === 0) ||
              (step === 2 && !messageBody)
            }
            className="btn-primary flex items-center gap-2 disabled:opacity-50"
          >
            Next <ChevronRight className="w-4 h-4" />
          </button>
        ) : (
          <button
            onClick={() => createCampaignMutation.mutate()}
            disabled={createCampaignMutation.isPending}
            className="btn-success flex items-center gap-2 disabled:opacity-50"
          >
            <Send className="w-4 h-4" />
            {createCampaignMutation.isPending ? 'Launching...' : 'Launch Campaign'}
          </button>
        )}
      </div>
    </div>
  );
}
