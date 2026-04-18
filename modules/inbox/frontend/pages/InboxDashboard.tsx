import { useState, useMemo, useCallback, memo } from 'react';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Inbox, MessageSquare, Smartphone, Mail,
  Search, Send, RefreshCcw, ArrowLeft, UserPlus,
  Star, CheckCircle, XCircle, Clock, Download,
} from 'lucide-react';
import { inboxApi } from '../../../../packages/ui/src/services/api';
import { useAppStore } from '../../../../packages/ui/src/stores/appStore';
import { cn, timeAgo, formatNumber } from '../../../../packages/utils/src/frontend-utils';
import { useDebounce } from '../../../../packages/ui/src/hooks/useDebounce';
import { Pagination } from '../../../../packages/ui/src/components/ui/Pagination';
import toast from 'react-hot-toast';

type Channel = 'whatsapp' | 'sms' | 'email';
type ThreadStatus = 'all' | 'unread' | 'read' | 'replied';

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
  created_at: string;
}

interface Message {
  id: string;
  thread_id: string;
  channel: Channel;
  direction: 'inbound' | 'outbound';
  provider_used: string | null;
  sender: string;
  recipient: string | null;
  subject: string | null;
  body: string;
  status: string;
  error_message: string | null;
  retry_count: number;
  created_at: string;
}

const channelIcon = { whatsapp: MessageSquare, sms: Smartphone, email: Mail };
const channelColor = { whatsapp: 'text-emerald-400', sms: 'text-blue-400', email: 'text-purple-400' };
const channelBg = { whatsapp: 'bg-emerald-500/10', sms: 'bg-blue-500/10', email: 'bg-purple-500/10' };

export default memo(function InboxDashboard() {
  const queryClient = useQueryClient();
  const inboxUnread = useAppStore((s) => s.inboxUnread);
  const decrementInboxUnread = useAppStore((s) => s.decrementInboxUnread);
  const setInboxUnread = useAppStore((s) => s.setInboxUnread);

  const [activeChannel, setActiveChannel] = useState<Channel>('whatsapp');
  const [statusFilter, setStatusFilter] = useState<ThreadStatus>('all');
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search);
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 50;
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [replySubject, setReplySubject] = useState('');
  const [assignInput, setAssignInput] = useState('');
  const [showAssign, setShowAssign] = useState(false);

  // ── Queries ──
  const { data: statsData } = useQuery({
    queryKey: ['inbox-stats'],
    queryFn: () => inboxApi.getStats(),
    staleTime: 30_000,
    refetchInterval: 60_000,
    select: (d: Record<string, unknown>) => {
      const stats = d.stats as Record<Channel, { unread: number; threads: number }>;
      if (stats) setInboxUnread({ whatsapp: stats.whatsapp?.unread ?? 0, sms: stats.sms?.unread ?? 0, email: stats.email?.unread ?? 0, instagram: 0, telegram: (d.stats as any)?.telegram?.unread ?? 0, messenger: (d.stats as any)?.messenger?.unread ?? 0 });
      return stats;
    },
  });

  const { data: threadsData, isLoading: loadingThreads } = useQuery({
    queryKey: ['inbox-threads', activeChannel, statusFilter, debouncedSearch, page],
    queryFn: () => inboxApi.listThreads({ channel: activeChannel, status: statusFilter, search: debouncedSearch || undefined, limit: PAGE_SIZE, offset: page * PAGE_SIZE }),
    staleTime: 15_000,
    refetchInterval: 30_000,
    placeholderData: keepPreviousData,
  });

  const threads: Thread[] = useMemo(() => (threadsData as any)?.threads ?? [], [threadsData]);

  const { data: threadDetail, isLoading: loadingDetail } = useQuery({
    queryKey: ['inbox-thread', selectedThreadId],
    queryFn: () => inboxApi.getThread(selectedThreadId!),
    enabled: !!selectedThreadId,
    staleTime: 10_000,
    refetchInterval: 15_000,
  });

  const selectedThread: Thread | null = threadDetail?.thread ?? null;
  const messages: Message[] = useMemo(() => threadDetail?.messages ?? [], [threadDetail]);

  // ── Mutations ──
  const markReadMutation = useMutation({
    mutationFn: (id: string) => inboxApi.markRead(id),
    onSuccess: (_d, id) => {
      const thread = threads.find((t) => t.id === id);
      if (thread) decrementInboxUnread(thread.channel, thread.unread_count || 1);
      queryClient.invalidateQueries({ queryKey: ['inbox-threads'] });
      queryClient.invalidateQueries({ queryKey: ['inbox-thread', id] });
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
      else toast.error(`Retry failed: ${data.error || 'Unknown'}`);
      queryClient.invalidateQueries({ queryKey: ['inbox-thread', selectedThreadId] });
    },
  });

  const assignMutation = useMutation({
    mutationFn: ({ id, to }: { id: string; to: string }) => inboxApi.assignThread(id, to),
    onSuccess: () => {
      toast.success('Thread assigned');
      setShowAssign(false);
      setAssignInput('');
      queryClient.invalidateQueries({ queryKey: ['inbox-threads'] });
      queryClient.invalidateQueries({ queryKey: ['inbox-thread', selectedThreadId] });
    },
  });

  const exportMutation = useMutation({
    mutationFn: (id: string) => inboxApi.exportThread(id),
    onSuccess: (data) => {
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = `thread-${selectedThreadId}.json`;
      a.click(); URL.revokeObjectURL(url);
    },
  });

  // ── Handlers ──
  const selectThread = useCallback((threadId: string) => {
    setSelectedThreadId(threadId);
    const thread = threads.find((t) => t.id === threadId);
    if (thread && thread.status === 'unread') markReadMutation.mutate(threadId);
  }, [threads, markReadMutation]);

  const handleReply = useCallback(() => {
    if (!selectedThreadId || !replyText.trim()) return;
    replyMutation.mutate({ id: selectedThreadId, body: replyText.trim(), subject: replySubject.trim() || undefined });
  }, [selectedThreadId, replyText, replySubject, replyMutation]);

  const totalUnread = inboxUnread.whatsapp + inboxUnread.sms + inboxUnread.email;
  const stats = statsData ?? { whatsapp: { unread: 0, threads: 0 }, sms: { unread: 0, threads: 0 }, email: { unread: 0, threads: 0 } };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-lg bg-brand-600"><Inbox className="w-6 h-6 text-white" /></div>
        <div>
          <h1 className="text-2xl font-bold">Inbox</h1>
          <p className="text-gray-500 dark:text-gray-400">Two-way messaging across all channels{totalUnread > 0 && ` · ${totalUnread} unread`}</p>
        </div>
      </div>

      {/* Channel Tabs */}
      <div className="flex gap-2">
        {(['whatsapp', 'sms', 'email'] as Channel[]).map((ch) => {
          const Icon = channelIcon[ch];
          const unread = inboxUnread[ch];
          return (
            <button
              key={ch}
              onClick={() => { setActiveChannel(ch); setSelectedThreadId(null); setPage(0); }}
              className={cn(
                'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all',
                activeChannel === ch ? `${channelBg[ch]} ${channelColor[ch]} ring-1 ring-current` : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
              )}
            >
              <Icon className="w-4 h-4" />
              <span className="capitalize">{ch}</span>
              {unread > 0 && <span className="ml-1 px-1.5 py-0.5 rounded-full bg-red-500 text-white text-xs font-bold">{unread}</span>}
              <span className="text-xs text-gray-500">({stats[ch]?.threads ?? 0})</span>
            </button>
          );
        })}
      </div>

      {/* Filters */}
      <div className="flex gap-2 items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="w-4 h-4 text-gray-500 absolute left-3 top-2.5" />
          <input className="input pl-9 py-2 text-sm w-full" placeholder="Search contacts, names..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} />
        </div>
        {(['all', 'unread', 'read', 'replied'] as ThreadStatus[]).map((s) => (
          <button
            key={s}
            onClick={() => { setStatusFilter(s); setPage(0); }}
            className={cn(
              'px-3 py-1.5 rounded text-xs font-medium capitalize transition-colors',
              statusFilter === s ? 'bg-brand-600 text-white' : 'text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700'
            )}
          >{s}</button>
        ))}
      </div>

      {/* Main Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 min-h-[600px]">
        {/* Thread List */}
        <div className="lg:col-span-1 card overflow-hidden flex flex-col">
          <div className="p-3 border-b border-gray-200 dark:border-gray-800 text-sm font-medium text-gray-700 dark:text-gray-300 flex justify-between items-center">
            <span>{formatNumber((threadsData as any)?.total ?? threads.length)} conversations</span>
            <button onClick={() => queryClient.invalidateQueries({ queryKey: ['inbox-threads'] })} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"><RefreshCcw className="w-3.5 h-3.5" /></button>
          </div>
          <div className="flex-1 overflow-y-auto">
            {loadingThreads && <p className="text-center text-gray-500 py-8">Loading…</p>}
            {!loadingThreads && threads.length === 0 && <p className="text-center text-gray-500 py-8">No conversations</p>}
            <AnimatePresence>
              {threads.map((t) => (
                <motion.button
                  key={t.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  onClick={() => selectThread(t.id)}
                  className={cn(
                    'w-full text-left px-4 py-3 border-b border-gray-200/50 dark:border-gray-800/50 hover:bg-gray-100/50 dark:hover:bg-gray-800/50 transition-colors',
                    selectedThreadId === t.id && 'bg-gray-100 dark:bg-gray-800',
                    t.status === 'unread' && 'border-l-2 border-l-brand-500'
                  )}
                >
                  <div className="flex items-center gap-2">
                    {t.is_vip && <Star className="w-3.5 h-3.5 text-yellow-400 flex-shrink-0" />}
                    <span className={cn('text-sm font-medium truncate', t.status === 'unread' && 'text-gray-900 dark:text-white')}>{t.contact_name || t.lead_name || t.contact_value}</span>
                    {t.unread_count > 0 && <span className="ml-auto px-1.5 py-0.5 rounded-full bg-brand-600 text-white text-xs font-bold flex-shrink-0">{t.unread_count}</span>}
                  </div>
                  <p className={cn('text-xs mt-0.5 truncate', t.status === 'unread' ? 'text-gray-700 dark:text-gray-300' : 'text-gray-500')}>{t.last_message_preview || '—'}</p>
                  <div className="flex items-center gap-2 mt-1 text-xs text-gray-600">
                    {t.campaign_name && <span className="truncate max-w-[120px]">{t.campaign_name}</span>}
                    {t.assigned_to && <span className="truncate">@{t.assigned_to}</span>}
                    <span className="ml-auto">{timeAgo(new Date(t.last_message_at).getTime())}</span>
                  </div>
                </motion.button>
              ))}
            </AnimatePresence>
          </div>
          <Pagination page={page} pageSize={PAGE_SIZE} total={(threadsData as any)?.total ?? 0} onPageChange={setPage} />
        </div>

        {/* Conversation Detail */}
        <div className="lg:col-span-2 card flex flex-col overflow-hidden">
          {!selectedThreadId ? (
            <div className="flex-1 flex items-center justify-center text-gray-500">
              <div className="text-center">
                <Inbox className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>Select a conversation to view messages</p>
              </div>
            </div>
          ) : (
            <>
              {/* Thread Header */}
              <div className="p-4 border-b border-gray-200 dark:border-gray-800 flex items-center gap-3">
                <button onClick={() => setSelectedThreadId(null)} className="lg:hidden p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"><ArrowLeft className="w-4 h-4" /></button>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    {selectedThread?.is_vip && <Star className="w-4 h-4 text-yellow-400" />}
                    <h3 className="font-semibold truncate">{selectedThread?.contact_name || selectedThread?.lead_name || selectedThread?.contact_value}</h3>
                    <span className={cn('text-xs px-2 py-0.5 rounded capitalize', selectedThread?.status === 'unread' ? 'bg-red-500/20 text-red-600 dark:text-red-400' : selectedThread?.status === 'replied' ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400' : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300')}>{selectedThread?.status}</span>
                  </div>
                  <p className="text-xs text-gray-500 truncate">{selectedThread?.contact_value}{selectedThread?.assigned_to ? ` · Assigned to ${selectedThread.assigned_to}` : ''}{selectedThread?.campaign_name ? ` · ${selectedThread.campaign_name}` : ''}</p>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => setShowAssign(!showAssign)} className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded" title="Assign"><UserPlus className="w-4 h-4 text-gray-500 dark:text-gray-400" /></button>
                  <button onClick={() => exportMutation.mutate(selectedThreadId)} className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded" title="Export"><Download className="w-4 h-4 text-gray-500 dark:text-gray-400" /></button>
                </div>
              </div>

              {/* Assign bar */}
              {showAssign && (
                <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-800 flex gap-2">
                  <input className="input py-1 text-sm flex-1" placeholder="Assign to user..." value={assignInput} onChange={(e) => setAssignInput(e.target.value)} />
                  <button onClick={() => { if (assignInput.trim()) assignMutation.mutate({ id: selectedThreadId, to: assignInput.trim() }); }} className="btn-primary py-1 px-3 text-sm">Assign</button>
                </div>
              )}

              {/* Messages */}
              <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3" style={{ maxHeight: 'calc(100vh - 420px)' }}>
                {loadingDetail && <p className="text-center text-gray-500 py-8">Loading…</p>}
                {messages.map((m) => (
                  <div key={m.id} className={cn('flex', m.direction === 'outbound' ? 'justify-end' : 'justify-start')}>
                    <div className={cn(
                      'max-w-[75%] rounded-xl px-4 py-2.5',
                      m.direction === 'outbound' ? 'bg-brand-600/20 text-gray-900 dark:text-gray-100' : 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200'
                    )}>
                      {m.subject && <p className="text-xs text-gray-400 mb-1 font-medium">{m.subject}</p>}
                      <p className="text-sm whitespace-pre-wrap break-words">{m.body}</p>
                      <div className="flex items-center gap-2 mt-1.5 text-xs text-gray-500">
                        <span>{new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        {m.direction === 'outbound' && (
                          <>
                            {m.status === 'sent' && <CheckCircle className="w-3 h-3 text-emerald-400" />}
                            {m.status === 'delivered' && <><CheckCircle className="w-3 h-3 text-emerald-400" /><CheckCircle className="w-3 h-3 text-emerald-400 -ml-1.5" /></>}
                            {m.status === 'failed' && <XCircle className="w-3 h-3 text-red-400" />}
                            {m.status === 'queued' && <Clock className="w-3 h-3 text-yellow-400" />}
                          </>
                        )}
                        {m.provider_used && <span className="capitalize">{m.provider_used}</span>}
                        {m.status === 'failed' && m.direction === 'outbound' && (
                          <button onClick={() => retryMutation.mutate(m.id)} className="ml-1 text-yellow-400 hover:text-yellow-300 flex items-center gap-0.5"><RefreshCcw className="w-3 h-3" />retry</button>
                        )}
                      </div>
                      {m.error_message && <p className="text-xs text-red-400 mt-1">{m.error_message}</p>}
                    </div>
                  </div>
                ))}
              </div>

              {/* Reply Composer */}
              <div className="border-t border-gray-200 dark:border-gray-800 p-3">
                {activeChannel === 'email' && (
                  <input className="input py-1.5 text-sm w-full mb-2" placeholder="Subject (optional)" value={replySubject} onChange={(e) => setReplySubject(e.target.value)} />
                )}
                <div className="flex gap-2">
                  <textarea
                    className="input py-2 text-sm flex-1 resize-none"
                    rows={2}
                    placeholder={`Reply via ${activeChannel}…`}
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleReply(); } }}
                  />
                  <button
                    onClick={handleReply}
                    disabled={!replyText.trim() || replyMutation.isPending}
                    className="btn-primary px-4 self-end disabled:opacity-50"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
});
