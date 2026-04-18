import { useState, useMemo, useCallback, useEffect, useRef, memo } from 'react';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MessageSquare, Smartphone, Mail, Search, Send, RefreshCcw,
  Star, CheckCircle, Clock, Download, UserPlus, Tag, TrendingUp,
} from 'lucide-react';
import { inboxApi, leadsApi } from '../../../../packages/ui/src/services/api';
import { useAppStore } from '../../../../packages/ui/src/stores/appStore';
import { cn, timeAgo, formatNumber } from '../../../../packages/utils/src/frontend-utils';
import { useDebounce } from '../../../../packages/ui/src/hooks/useDebounce';
import { Pagination } from '../../../../packages/ui/src/components/ui/Pagination';
import toast from 'react-hot-toast';

type Channel = 'whatsapp' | 'sms' | 'email' | 'telegram' | 'messenger';
type ThreadStatus = 'all' | 'unread' | 'read' | 'replied';
type Segment = 'hot' | 'warm' | 'cold';

interface Thread {
  id: string;
  channel: Channel;
  campaign_id: string | null;
  campaign_name?: string | null;
  contact_value: string;
  contact_name: string | null;
  lead_name: string | null;
  is_vip: boolean;
  assigned_to: string | null;
  status: 'unread' | 'read' | 'replied';
  unread_count: number;
  last_message_preview: string | null;
  last_message_at: string;
}

interface Message {
  id: string;
  thread_id: string;
  direction: 'inbound' | 'outbound';
  provider_used: string | null;
  sender: string;
  subject: string | null;
  body: string;
  status: string;
  error_message: string | null;
  retry_count: number;
  created_at: string;
}

interface Lead {
  id: string;
  channel: Channel;
  contact_value: string;
  name: string | null;
  segment: Segment;
  tags: string[];
  is_vip: boolean;
  assigned_to: string | null;
  response_count: number;
  last_contacted_at: string | null;
}

const channelIcon = { whatsapp: MessageSquare, sms: Smartphone, email: Mail, telegram: Send, messenger: MessageSquare };
const channelColor = { whatsapp: 'text-emerald-400', sms: 'text-blue-400', email: 'text-purple-400', telegram: 'text-sky-400', messenger: 'text-blue-500' };
const channelBg = { whatsapp: 'bg-emerald-500/10', sms: 'bg-blue-500/10', email: 'bg-purple-500/10', telegram: 'bg-sky-500/10', messenger: 'bg-blue-600/10' };
const segmentColor: Record<Segment, string> = { hot: 'bg-red-500/20 text-red-300', warm: 'bg-orange-500/20 text-orange-300', cold: 'bg-blue-500/20 text-blue-300' };

interface Props { channel: Channel; }

export default memo(function ChannelInbox({ channel }: Props) {
  const queryClient = useQueryClient();
  const { inboxUnread, decrementInboxUnread, setInboxUnread } = useAppStore();
  const Icon = channelIcon[channel];

  const [statusFilter, setStatusFilter] = useState<ThreadStatus>('all');
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search);
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [replySubject, setReplySubject] = useState('');
  const [assignInput, setAssignInput] = useState('');
  const [showAssign, setShowAssign] = useState(false);
  const [showLeadPanel, setShowLeadPanel] = useState(false);
  const [newTag, setNewTag] = useState('');
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 50;
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // ── Queries ────────────────────────────────────────────────────────────────
  const { data: statsData } = useQuery({
    queryKey: ['inbox-stats'],
    queryFn: () => inboxApi.getStats(),
    staleTime: 30_000,
    refetchInterval: 60_000,
    select: (d: Record<string, unknown>) =>
      d.stats as Record<Channel, { unread: number; threads: number }>,
  });

  // Sync unread counts to global store — must be in useEffect, not in select,
  // to avoid a state-update-during-render infinite loop.
  useEffect(() => {
    if (!statsData) return;
    setInboxUnread({
      whatsapp: statsData.whatsapp?.unread ?? 0,
      sms: statsData.sms?.unread ?? 0,
      email: statsData.email?.unread ?? 0,
      instagram: 0,
      telegram: statsData.telegram?.unread ?? 0,
      messenger: statsData.messenger?.unread ?? 0,
    });
  }, [statsData, setInboxUnread]);

  const { data: threadsData, isLoading: loadingThreads } = useQuery({
    queryKey: ['inbox-threads', channel, statusFilter, debouncedSearch, page],
    queryFn: () => inboxApi.listThreads({ channel, status: statusFilter, search: debouncedSearch || undefined, limit: PAGE_SIZE, offset: page * PAGE_SIZE }),
    staleTime: 15_000,
    refetchInterval: 30_000,
    placeholderData: keepPreviousData,
  });

  const threads: Thread[] = useMemo(() => (threadsData as any)?.threads ?? [], [threadsData]);
  const threadsTotal = (threadsData as any)?.total ?? threads.length;

  const { data: threadDetail, isLoading: loadingDetail } = useQuery({
    queryKey: ['inbox-thread', selectedThreadId],
    queryFn: () => inboxApi.getThread(selectedThreadId!),
    enabled: !!selectedThreadId,
    staleTime: 10_000,
    refetchInterval: 15_000,
  });

  const selectedThread: Thread | null = threadDetail?.thread ?? null;
  const messages: Message[] = useMemo(() => threadDetail?.messages ?? [], [threadDetail]);

  const { data: leadData, refetch: refetchLead } = useQuery({
    queryKey: ['lead-by-contact', channel, selectedThread?.contact_value],
    queryFn: () => leadsApi.list({ channel, search: selectedThread!.contact_value, limit: 1 }),
    enabled: !!selectedThread,
    select: (d: { leads: Lead[] }) => d.leads[0] ?? null,
  });

  const currentLead: Lead | null = leadData ?? null;

  // ── Auto-scroll ────────────────────────────────────────────────────────────
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  // ── Mutations ──────────────────────────────────────────────────────────────
  const markReadMutation = useMutation({
    mutationFn: (id: string) => inboxApi.markRead(id),
    onSuccess: (_d, id) => {
      const t = threads.find((t) => t.id === id);
      if (t) decrementInboxUnread(t.channel, t.unread_count || 1);
      queryClient.invalidateQueries({ queryKey: ['inbox-threads'] });
    },
  });

  const replyMutation = useMutation({
    mutationFn: ({ id, body, subject }: { id: string; body: string; subject?: string }) =>
      inboxApi.sendReply(id, { body, subject: subject || undefined }),
    onSuccess: (data) => {
      if (data.success) { toast.success('Reply sent'); setReplyText(''); setReplySubject(''); }
      else toast.error(`Reply failed: ${data.error || 'Unknown'}`);
      queryClient.invalidateQueries({ queryKey: ['inbox-thread', selectedThreadId] });
      queryClient.invalidateQueries({ queryKey: ['inbox-threads'] });
    },
    onError: () => toast.error('Failed to send reply'),
  });

  const retryMutation = useMutation({
    mutationFn: (messageId: string) => inboxApi.retryReply(messageId),
    onSuccess: (data) => {
      if (data.success) toast.success('Retry queued');
      else toast.error(`Retry failed: ${data.error}`);
      queryClient.invalidateQueries({ queryKey: ['inbox-thread', selectedThreadId] });
    },
  });

  const assignMutation = useMutation({
    mutationFn: ({ id, to }: { id: string; to: string }) => inboxApi.assignThread(id, to),
    onSuccess: () => {
      toast.success('Assigned'); setShowAssign(false); setAssignInput('');
      queryClient.invalidateQueries({ queryKey: ['inbox-threads'] });
      queryClient.invalidateQueries({ queryKey: ['inbox-thread', selectedThreadId] });
    },
  });

  const setSegmentMutation = useMutation({
    mutationFn: ({ id, segment }: { id: string; segment: Segment }) => leadsApi.setSegment(id, segment),
    onSuccess: () => { toast.success('Segment updated'); refetchLead(); },
  });

  const tagMutation = useMutation({
    mutationFn: ({ id, tags }: { id: string; tags: string[] }) => leadsApi.tag(id, tags, 'add'),
    onSuccess: () => { toast.success('Tag added'); setNewTag(''); refetchLead(); },
  });

  const removeTagMutation = useMutation({
    mutationFn: ({ id, tags }: { id: string; tags: string[] }) => leadsApi.tag(id, tags, 'remove'),
    onSuccess: () => { toast.success('Tag removed'); refetchLead(); },
  });

  // ── Handlers ──────────────────────────────────────────────────────────────
  const selectThread = useCallback((threadId: string) => {
    setSelectedThreadId(threadId);
    setShowLeadPanel(false);
    const t = threads.find((t) => t.id === threadId);
    if (t?.status === 'unread') markReadMutation.mutate(threadId);
  }, [threads, markReadMutation]);

  const handleReply = useCallback(() => {
    if (!selectedThreadId || !replyText.trim()) return;
    replyMutation.mutate({ id: selectedThreadId, body: replyText.trim(), subject: replySubject.trim() || undefined });
  }, [selectedThreadId, replyText, replySubject, replyMutation]);

  const handleExport = useCallback(() => {
    if (!threadDetail) return;
    const blob = new Blob([JSON.stringify(threadDetail, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `thread-${selectedThreadId}.json`;
    a.click(); URL.revokeObjectURL(url);
  }, [threadDetail, selectedThreadId]);

  const stats: Record<Channel, { unread: number; threads: number }> = (statsData ?? {}) as Record<Channel, { unread: number; threads: number }>;
  const channelStats = stats[channel] ?? { unread: 0, threads: 0 };

  const unreadCount = inboxUnread[channel] ?? 0;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className={cn('p-2.5 rounded-lg', channelBg[channel])}>
          <Icon className={cn('w-6 h-6', channelColor[channel])} />
        </div>
        <div>
          <h1 className="text-2xl font-bold capitalize">{channel} Inbox</h1>
          <p className="text-gray-400">
            {formatNumber(channelStats.threads)} conversations
            {unreadCount > 0 && ` · ${unreadCount} unread`}
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <button onClick={() => queryClient.invalidateQueries({ queryKey: ['inbox-threads', channel] })} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg">
            <RefreshCcw className="w-4 h-4 text-gray-400" />
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2 items-center flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search className="w-4 h-4 text-gray-500 absolute left-3 top-2.5" />
          <input className="input pl-9 py-2 text-sm w-full" placeholder="Search contacts..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} />
        </div>
        {(['all', 'unread', 'read', 'replied'] as ThreadStatus[]).map((s) => (
          <button key={s} onClick={() => { setStatusFilter(s); setPage(0); }}
            className={cn('px-3 py-1.5 rounded text-xs font-medium capitalize transition-colors',
              statusFilter === s ? 'bg-brand-600 text-white' : 'text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700'
            )}>{s}</button>
        ))}
      </div>

      {/* Main Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 xl:grid-cols-4 gap-4 min-h-[640px]">
        {/* Thread List */}
        <div className="lg:col-span-1 card overflow-hidden flex flex-col">
          <div className="p-3 border-b border-gray-200 dark:border-gray-800 text-sm text-gray-500 dark:text-gray-400 flex justify-between">
            <span>{formatNumber(threadsTotal)} threads</span>
            {unreadCount > 0 && <span className="text-red-400 text-xs font-bold">{unreadCount} unread</span>}
          </div>
          <div className="flex-1 overflow-y-auto">
            {loadingThreads && <p className="text-center text-gray-500 py-8 text-sm">Loading…</p>}
            {!loadingThreads && threads.length === 0 && <p className="text-center text-gray-500 py-8 text-sm">No conversations</p>}
            <AnimatePresence>
              {threads.map((t) => (
                <motion.button key={t.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  onClick={() => selectThread(t.id)}
                  className={cn('w-full text-left px-3 py-3 border-b border-gray-200/50 dark:border-gray-800/50 hover:bg-gray-100/40 dark:hover:bg-gray-800/40 transition-colors',
                    selectedThreadId === t.id && 'bg-gray-100 dark:bg-gray-800',
                    t.is_vip && 'border-l-2 border-l-yellow-400',
                    t.status === 'unread' && !t.is_vip && 'border-l-2 border-l-brand-500'
                  )}>
                  <div className="flex items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        {t.is_vip && <Star className="w-3 h-3 text-yellow-400 fill-yellow-400 flex-shrink-0" />}
                        <span className="text-sm font-medium truncate">{t.lead_name || t.contact_name || t.contact_value}</span>
                        {t.unread_count > 0 && (
                          <span className="ml-auto flex-shrink-0 px-1.5 py-0.5 rounded-full bg-brand-600 text-white text-xs">{t.unread_count}</span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 truncate mt-0.5">{t.last_message_preview || 'No messages'}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-gray-600">{timeAgo(new Date(t.last_message_at).getTime())}</span>
                        {t.assigned_to && <span className="text-xs text-gray-600 truncate">→ {t.assigned_to}</span>}
                      </div>
                    </div>
                    <StatusDot status={t.status} />
                  </div>
                </motion.button>
              ))}
            </AnimatePresence>
          </div>
          <Pagination page={page} pageSize={PAGE_SIZE} total={threadsTotal} onPageChange={setPage} />
        </div>

        {/* Conversation */}
        <div className={cn('card overflow-hidden flex flex-col', showLeadPanel ? 'lg:col-span-1 xl:col-span-2' : 'lg:col-span-2 xl:col-span-3')}>
          {!selectedThread ? (
            <div className="flex-1 flex items-center justify-center text-gray-500">
              <div className="text-center">
                <Icon className={cn('w-12 h-12 mx-auto mb-3 opacity-20', channelColor[channel])} />
                <p className="text-sm">Select a conversation</p>
              </div>
            </div>
          ) : (
            <>
              {/* Thread header */}
              <div className="p-3 border-b border-gray-200 dark:border-gray-800 flex items-center gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    {selectedThread.is_vip && <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />}
                    <span className="font-medium">{selectedThread.lead_name || selectedThread.contact_name || selectedThread.contact_value}</span>
                    {currentLead && (
                      <span className={cn('px-1.5 py-0.5 rounded text-xs font-medium', segmentColor[currentLead.segment])}>
                        {currentLead.segment}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500">{selectedThread.contact_value}</p>
                </div>
                <div className="ml-auto flex items-center gap-1">
                  <button onClick={() => setShowLeadPanel(!showLeadPanel)} title="Lead info"
                    className={cn('p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700', showLeadPanel && 'bg-gray-200 dark:bg-gray-700')}>
                    <TrendingUp className="w-4 h-4 text-gray-400" />
                  </button>
                  <button onClick={() => setShowAssign(!showAssign)} title="Assign" className="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700">
                    <UserPlus className="w-4 h-4 text-gray-400" />
                  </button>
                  <button onClick={handleExport} title="Export" className="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700">
                    <Download className="w-4 h-4 text-gray-400" />
                  </button>
                </div>
              </div>

              {/* Assign input */}
              <AnimatePresence>
                {showAssign && (
                  <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }}
                    className="px-3 py-2 border-b border-gray-200 dark:border-gray-800 flex gap-2 overflow-hidden">
                    <input className="input flex-1 py-1.5 text-sm" placeholder="Assign to (name/email)..."
                      value={assignInput} onChange={(e) => setAssignInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && assignInput.trim() && assignMutation.mutate({ id: selectedThreadId!, to: assignInput.trim() })} />
                    <button className="btn-primary text-xs px-3 py-1.5"
                      onClick={() => assignInput.trim() && assignMutation.mutate({ id: selectedThreadId!, to: assignInput.trim() })}
                      disabled={!assignInput.trim() || assignMutation.isPending}>Assign</button>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-3 space-y-3">
                {loadingDetail && <p className="text-center text-gray-500 py-4 text-sm">Loading…</p>}
                <AnimatePresence initial={false}>
                  {messages.map((m) => (
                    <motion.div key={m.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                      className={cn('flex', m.direction === 'outbound' ? 'justify-end' : 'justify-start')}>
                      <div className={cn('max-w-[75%] rounded-2xl px-3.5 py-2.5 text-sm',
                        m.direction === 'outbound'
                          ? 'bg-brand-600 text-white rounded-br-sm'
                          : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-bl-sm'
                      )}>
                        {m.subject && <p className="text-xs opacity-70 mb-1 font-medium">{m.subject}</p>}
                        <p className="whitespace-pre-wrap break-words">{m.body}</p>
                        <div className="flex items-center gap-1.5 mt-1.5 opacity-60">
                          <span className="text-xs">{timeAgo(new Date(m.created_at).getTime())}</span>
                          {m.direction === 'outbound' && <MessageStatus status={m.status} />}
                          {m.status === 'failed' && (
                            <button onClick={() => retryMutation.mutate(m.id)} className="text-xs underline ml-1 opacity-80 hover:opacity-100">Retry</button>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
                <div ref={messagesEndRef} />
              </div>

              {/* Reply box */}
              <div className="p-3 border-t border-gray-200 dark:border-gray-800">
                {channel === 'email' && (
                  <input className="input w-full mb-2 py-1.5 text-sm" placeholder="Subject (optional)"
                    value={replySubject} onChange={(e) => setReplySubject(e.target.value)} />
                )}
                <div className="flex gap-2">
                  <textarea
                    className="input flex-1 py-2 text-sm resize-none"
                    rows={2}
                    placeholder="Type a reply…"
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleReply(); } }}
                  />
                  <button className="btn-primary px-3 py-2 self-end" onClick={handleReply}
                    disabled={!replyText.trim() || replyMutation.isPending}>
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Lead Info Panel */}
        <AnimatePresence>
          {showLeadPanel && selectedThread && (
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}
              className="xl:col-span-1 card p-4 space-y-4 overflow-y-auto">
              <h3 className="font-semibold text-gray-200 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-brand-400" /> Lead Info
              </h3>
              {!currentLead ? (
                <p className="text-gray-500 text-sm">No lead record yet</p>
              ) : (
                <>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Segment</p>
                    <div className="flex gap-1.5 flex-wrap">
                      {(['hot', 'warm', 'cold'] as Segment[]).map((s) => (
                        <button key={s} onClick={() => setSegmentMutation.mutate({ id: currentLead.id, segment: s })}
                          className={cn('px-2.5 py-1 rounded-full text-xs font-medium transition-all',
                            currentLead.segment === s ? segmentColor[s] : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                          )}>{s}</button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Tags</p>
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {currentLead.tags.map((tag) => (
                        <span key={tag} className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-xs">
                          {tag}
                          <button onClick={() => removeTagMutation.mutate({ id: currentLead.id, tags: [tag] })} className="hover:text-red-400 leading-none">×</button>
                        </span>
                      ))}
                      {currentLead.tags.length === 0 && <span className="text-gray-600 text-xs">No tags</span>}
                    </div>
                    <div className="flex gap-1">
                      <input className="input flex-1 py-1 text-xs" placeholder="Add tag…" value={newTag} onChange={(e) => setNewTag(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter' && newTag.trim()) tagMutation.mutate({ id: currentLead.id, tags: [newTag.trim()] }); }} />
                      <button onClick={() => newTag.trim() && tagMutation.mutate({ id: currentLead.id, tags: [newTag.trim()] })}
                        className="p-1.5 bg-gray-200 dark:bg-gray-700 rounded hover:bg-gray-300 dark:hover:bg-gray-600">
                        <Tag className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between"><span className="text-gray-500">Responses</span><span>{currentLead.response_count}</span></div>
                    <div className="flex justify-between"><span className="text-gray-500">VIP</span><span>{currentLead.is_vip ? '⭐ Yes' : 'No'}</span></div>
                    {currentLead.assigned_to && <div className="flex justify-between"><span className="text-gray-500">Assigned</span><span className="truncate ml-2">{currentLead.assigned_to}</span></div>}
                    {currentLead.last_contacted_at && <div className="flex justify-between"><span className="text-gray-500">Last contact</span><span>{timeAgo(new Date(currentLead.last_contacted_at).getTime())}</span></div>}
                  </div>
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
});

function StatusDot({ status }: { status: string }) {
  const map: Record<string, string> = { unread: 'bg-brand-500', read: 'bg-gray-600', replied: 'bg-emerald-500' };
  return <div className={cn('w-2 h-2 rounded-full flex-shrink-0 mt-2', map[status] ?? 'bg-gray-700')} />;
}

function MessageStatus({ status }: { status: string }) {
  if (status === 'delivered') return <CheckCircle className="w-3 h-3" />;
  if (status === 'sent') return <Clock className="w-3 h-3 opacity-60" />;
  return null;
}
