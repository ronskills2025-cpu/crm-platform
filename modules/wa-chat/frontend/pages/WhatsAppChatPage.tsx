import { memo, useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, Send, Paperclip, Check, CheckCheck, Clock, AlertCircle,
  Pin, Archive, MoreVertical, ArrowLeft, Image, FileText, Smile,
  MessageSquare, Phone, Building2, CheckCircle, XCircle, Timer,
  Settings, Wifi, WifiOff, AlertTriangle,
} from 'lucide-react';
import { useDebounce } from '../../../../packages/ui/src/hooks/useDebounce';
import toast from 'react-hot-toast';
import * as waChatApi from '../wa-chat.api';
import type { WaChatConversation, WaChatMessage } from '../wa-chat.api';
import { useAppStore } from '../../../../packages/ui/src/stores/appStore';

// ── Helpers ──────────────────────────────────────────────────────

function cn(...classes: (string | boolean | undefined | null)[]) {
  return classes.filter(Boolean).join(' ');
}

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const now = Date.now();
  const diff = now - d.getTime();
  if (diff < 60_000) return 'now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h`;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function formatTimeRemaining(milliseconds: number): string {
  if (milliseconds <= 0) return 'Expired';
  const hours = Math.floor(milliseconds / (1000 * 60 * 60));
  const minutes = Math.floor((milliseconds % (1000 * 60 * 60)) / (1000 * 60));
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

function StatusIcon({ status }: { status: string }) {
  switch (status) {
    case 'sent':
      return <Check size={14} className="text-gray-400" />;
    case 'delivered':
      return <CheckCheck size={14} className="text-gray-400" />;
    case 'read':
      return <CheckCheck size={14} className="text-blue-500" />;
    case 'failed':
      return <AlertCircle size={14} className="text-red-500" />;
    default:
      return <Clock size={14} className="text-gray-300" />;
  }
}

function Avatar({ name, pic, size = 40 }: { name: string | null; pic?: string | null; size?: number }) {
  if (pic) {
    return <img src={pic} alt="" className="rounded-full object-cover" style={{ width: size, height: size }} />;
  }
  const initials = (name || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  const colors = ['bg-green-600', 'bg-blue-600', 'bg-purple-600', 'bg-orange-600', 'bg-pink-600', 'bg-teal-600'];
  const color = colors[(name || '').charCodeAt(0) % colors.length];
  return (
    <div
      className={cn('rounded-full flex items-center justify-center text-white font-semibold', color)}
      style={{ width: size, height: size, fontSize: size * 0.38 }}
    >
      {initials}
    </div>
  );
}

// ── Business Header ──────────────────────────────────────────────

function BusinessHeader() {
  const { data: credsData, isLoading } = useQuery({
    queryKey: ['wa-chat-credentials'],
    queryFn: waChatApi.getCredentials,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  const creds = credsData?.credentials;

  if (isLoading) {
    return (
      <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
        <div className="animate-pulse flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gray-200 dark:bg-gray-700" />
          <div className="flex-1 space-y-1">
            <div className="h-4 w-32 bg-gray-200 dark:bg-gray-700 rounded" />
            <div className="h-3 w-24 bg-gray-200 dark:bg-gray-700 rounded" />
          </div>
        </div>
      </div>
    );
  }

  if (!creds || !creds.is_active) {
    return (
      <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-800 bg-yellow-50 dark:bg-yellow-950/30">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center">
            <AlertTriangle size={16} className="text-yellow-600" />
          </div>
          <div className="flex-1">
            <h3 className="font-medium text-sm text-yellow-800 dark:text-yellow-200">WhatsApp Not Connected</h3>
            <p className="text-xs text-yellow-600 dark:text-yellow-400">Configure your credentials to start chatting</p>
          </div>
          <button
            onClick={() => window.location.href = '/wa-chat/settings'}
            className="px-3 py-1.5 text-xs rounded-lg bg-yellow-500 text-white hover:bg-yellow-600 flex items-center gap-1"
          >
            <Settings size={12} />
            Setup
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-800 bg-green-50 dark:bg-green-950/30">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
          <Building2 size={16} className="text-green-600" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-medium text-sm text-green-800 dark:text-green-200 truncate">
              {creds.display_name || 'WhatsApp Business'}
            </h3>
            <div className="flex items-center gap-1">
              <Wifi size={12} className="text-green-500" />
              <span className="text-xs text-green-600 dark:text-green-400">Connected</span>
            </div>
          </div>
          <div className="flex items-center gap-3 text-xs text-green-600 dark:text-green-400">
            <span className="flex items-center gap-1">
              <Phone size={10} />
              {creds.phone_number_id}
            </span>
            {creds.last_verified_at && (
              <span>Verified {timeAgo(creds.last_verified_at)}</span>
            )}
          </div>
        </div>
        <button
          onClick={() => window.location.href = '/wa-chat/settings'}
          className="p-1.5 text-green-600 hover:bg-green-100 dark:hover:bg-green-900/30 rounded-lg"
        >
          <Settings size={14} />
        </button>
      </div>
    </div>
  );
}

// ── Chat List (Left Panel) ───────────────────────────────────────

function ChatList({
  conversations,
  selectedId,
  onSelect,
  search,
  onSearchChange,
  isLoading,
}: {
  conversations: WaChatConversation[];
  selectedId: string | null;
  onSelect: (c: WaChatConversation) => void;
  search: string;
  onSearchChange: (s: string) => void;
  isLoading: boolean;
}) {
  const pinned = useMemo(() => conversations.filter(c => c.is_pinned), [conversations]);
  const unpinned = useMemo(() => conversations.filter(c => !c.is_pinned), [conversations]);

  return (
    <div className="flex flex-col h-full border-r border-gray-200 dark:border-gray-800">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-800">
        <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
          <MessageSquare size={20} className="text-green-500" />
          WhatsApp Chat
        </h2>
        <div className="mt-2 relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search conversations..."
            value={search}
            onChange={e => onSearchChange(e.target.value)}
            className="w-full pl-9 pr-3 py-2 rounded-lg bg-gray-100 dark:bg-gray-800 border-none text-sm focus:outline-none focus:ring-2 focus:ring-green-500/50"
          />
        </div>
      </div>

      {/* Conversation List */}
      <div className="flex-1 overflow-y-auto">
        {isLoading && (
          <div className="p-4 space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex gap-3 animate-pulse">
                <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-700" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-24 rounded bg-gray-200 dark:bg-gray-700" />
                  <div className="h-3 w-40 rounded bg-gray-200 dark:bg-gray-700" />
                </div>
              </div>
            ))}
          </div>
        )}

        {!isLoading && conversations.length === 0 && (
          <div className="p-8 text-center text-gray-400">
            <MessageSquare size={40} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">No conversations yet</p>
          </div>
        )}

        <AnimatePresence>
          {pinned.length > 0 && (
            <>
              <div className="px-4 py-1 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                Pinned
              </div>
              {pinned.map(c => (
                <ConversationItem key={c.id} conversation={c} selected={c.id === selectedId} onSelect={onSelect} />
              ))}
              {unpinned.length > 0 && (
                <div className="px-4 py-1 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  All Chats
                </div>
              )}
            </>
          )}
          {unpinned.map(c => (
            <ConversationItem key={c.id} conversation={c} selected={c.id === selectedId} onSelect={onSelect} />
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}

function ConversationItem({
  conversation: c,
  selected,
  onSelect,
}: {
  conversation: WaChatConversation;
  selected: boolean;
  onSelect: (c: WaChatConversation) => void;
}) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className={cn(
        'flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors',
        selected
          ? 'bg-green-50 dark:bg-green-950/30 border-r-2 border-green-500'
          : 'hover:bg-gray-50 dark:hover:bg-gray-800/50',
      )}
      onClick={() => onSelect(c)}
    >
      <Avatar name={c.display_name} pic={c.profile_pic_url} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <span className="font-medium text-sm text-gray-900 dark:text-gray-100 truncate flex items-center gap-1">
            {c.display_name || c.wa_id}
            {c.is_pinned && <Pin size={12} className="text-gray-400" />}
          </span>
          <span className="text-xs text-gray-400 ml-1 flex-shrink-0">{timeAgo(c.last_message_at)}</span>
        </div>
        <div className="flex items-center justify-between mt-0.5">
          <span className="text-xs text-gray-500 dark:text-gray-400 truncate">
            {c.last_message_text || 'No messages yet'}
          </span>
          {c.unread_count > 0 && (
            <span className="ml-1 flex-shrink-0 min-w-5 h-5 flex items-center justify-center rounded-full bg-green-500 text-white text-xs font-bold px-1.5">
              {c.unread_count > 99 ? '99+' : c.unread_count}
            </span>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// ── Message Panel (Right Panel) ──────────────────────────────────

function MessagePanel({
  conversation,
  onBack,
}: {
  conversation: WaChatConversation;
  onBack: () => void;
}) {
  const queryClient = useQueryClient();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [text, setText] = useState('');
  const [showMenu, setShowMenu] = useState(false);

  const { data, isLoading, fetchNextPage, hasNextPage } = useInfiniteMessages(conversation.id);
  const messages = useMemo(() => {
    return (data ?? []).slice().reverse();
  }, [data]);

  // 24-hour window status
  const { data: windowData } = useQuery({
    queryKey: ['wa-chat-window-status', conversation.id],
    queryFn: () => waChatApi.getWindowStatus(conversation.id),
    refetchInterval: 60_000, // Update every minute
    staleTime: 30_000,
  });

  // Send text
  const sendMut = useMutation({
    mutationFn: (t: string) => waChatApi.sendTextMessage(conversation.id, t),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['wa-chat-messages', conversation.id] });
      queryClient.invalidateQueries({ queryKey: ['wa-chat-conversations'] });
    },
    onError: () => toast.error('Failed to send message'),
  });

  // Mark read
  const markReadMut = useMutation({
    mutationFn: () => waChatApi.markConversationRead(conversation.id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['wa-chat-conversations'] }),
  });

  // Pin / Archive
  const pinMut = useMutation({
    mutationFn: () => waChatApi.pinConversation(conversation.id, !conversation.is_pinned),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wa-chat-conversations'] });
      toast.success(conversation.is_pinned ? 'Unpinned' : 'Pinned');
    },
  });

  const archiveMut = useMutation({
    mutationFn: () => waChatApi.archiveConversation(conversation.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wa-chat-conversations'] });
      toast.success('Archived');
    },
  });

  // Auto-scroll on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  // Mark as read when opened
  useEffect(() => {
    if (conversation.unread_count > 0) {
      markReadMut.mutate();
    }
  }, [conversation.id]);

  // Infinite scroll up
  const handleScroll = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    if (el.scrollTop < 100 && hasNextPage) {
      fetchNextPage();
    }
  }, [hasNextPage, fetchNextPage]);

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed || sendMut.isPending) return;
    
    // Check 24-hour window
    if (windowData && !windowData.can_send) {
      toast.error('24-hour messaging window has expired. Customer needs to send a message first.');
      return;
    }
    
    setText('');
    sendMut.mutate(trimmed);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
        <button onClick={onBack} className="md:hidden p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded">
          <ArrowLeft size={20} />
        </button>
        <Avatar name={conversation.display_name} pic={conversation.profile_pic_url} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-sm truncate">{conversation.display_name || conversation.wa_id}</h3>
            {windowData && (
              <div className={cn(
                'flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium',
                windowData.can_send
                  ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                  : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
              )}>
                <Timer size={10} />
                {windowData.can_send 
                  ? formatTimeRemaining(windowData.time_remaining)
                  : 'Expired'
                }
              </div>
            )}
          </div>
          <p className="text-xs text-gray-400">+{conversation.wa_id}</p>
        </div>
        <div className="relative">
          <button
            onClick={() => setShowMenu(v => !v)}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
          >
            <MoreVertical size={18} />
          </button>
          {showMenu && (
            <div className="absolute right-0 mt-1 w-40 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 z-50">
              <button
                onClick={() => { pinMut.mutate(); setShowMenu(false); }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <Pin size={14} /> {conversation.is_pinned ? 'Unpin' : 'Pin'}
              </button>
              <button
                onClick={() => { archiveMut.mutate(); setShowMenu(false); }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <Archive size={14} /> Archive
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Messages */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto p-4 space-y-1 bg-[#efeae2] dark:bg-gray-950"
        style={{
          backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%239C92AC\' fill-opacity=\'0.05\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")',
        }}
      >
        {isLoading && (
          <div className="flex justify-center py-4">
            <div className="animate-spin h-6 w-6 border-2 border-green-500 border-t-transparent rounded-full" />
          </div>
        )}

        {messages.map((msg, i) => {
          const showDate = i === 0 || new Date(messages[i - 1].created_at).toDateString() !== new Date(msg.created_at).toDateString();
          return (
            <div key={msg.id}>
              {showDate && (
                <div className="flex justify-center my-3">
                  <span className="bg-white/80 dark:bg-gray-800/80 text-xs text-gray-500 px-3 py-1 rounded-lg shadow-sm">
                    {new Date(msg.created_at).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}
                  </span>
                </div>
              )}
              <MessageBubble message={msg} />
            </div>
          );
        })}

        <div ref={messagesEndRef} />
      </div>

      {/* 24-hour window warning */}
      {windowData && !windowData.can_send && (
        <div className="px-4 py-2 bg-red-50 dark:bg-red-950/30 border-t border-red-200 dark:border-red-800">
          <div className="flex items-center gap-2 text-sm text-red-700 dark:text-red-300">
            <AlertTriangle size={16} />
            <span>24-hour messaging window expired. Customer needs to send a message to reopen the window.</span>
          </div>
        </div>
      )}

      {/* Input */}
      <div className="px-3 py-2 border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 flex items-end gap-2">
        <button className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800">
          <Smile size={22} />
        </button>
        <button className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800">
          <Paperclip size={22} />
        </button>
        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={windowData && !windowData.can_send ? "Cannot send - window expired" : "Type a message..."}
          rows={1}
          disabled={windowData && !windowData.can_send}
          className={cn(
            "flex-1 resize-none rounded-xl px-4 py-2.5 text-sm focus:outline-none max-h-32",
            windowData && !windowData.can_send
              ? "bg-gray-100 dark:bg-gray-800 text-gray-400 cursor-not-allowed"
              : "bg-gray-100 dark:bg-gray-800 focus:ring-2 focus:ring-green-500/50"
          )}
          style={{ minHeight: 40 }}
        />
        <button
          onClick={handleSend}
          disabled={!text.trim() || sendMut.isPending || (windowData && !windowData.can_send)}
          className={cn(
            'p-2.5 rounded-full transition-colors',
            text.trim() && (!windowData || windowData.can_send) 
              ? 'bg-green-500 text-white hover:bg-green-600' 
              : 'bg-gray-200 dark:bg-gray-700 text-gray-400',
          )}
        >
          <Send size={18} />
        </button>
      </div>
    </div>
  );
}

function MessageBubble({ message: msg }: { message: WaChatMessage }) {
  const isOut = msg.direction === 'outbound';
  return (
    <div className={cn('flex', isOut ? 'justify-end' : 'justify-start')}>
      <div
        className={cn(
          'max-w-[75%] rounded-2xl px-3.5 py-2 shadow-sm relative',
          isOut
            ? 'bg-[#d9fdd3] dark:bg-green-900/40 text-gray-900 dark:text-gray-100 rounded-tr-md'
            : 'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-tl-md',
        )}
      >
        {/* Media preview */}
        {msg.media_url && (msg.message_type === 'image' || msg.message_type === 'sticker') && (
          <div className="mb-1 rounded-lg overflow-hidden">
            <Image size={40} className="text-gray-300" />
            <span className="text-xs text-gray-400">[{msg.message_type}]</span>
          </div>
        )}
        {msg.media_url && msg.message_type === 'document' && (
          <div className="flex items-center gap-2 mb-1 p-2 rounded bg-gray-100 dark:bg-gray-700">
            <FileText size={20} className="text-gray-400" />
            <span className="text-xs truncate">{msg.media_filename || 'Document'}</span>
          </div>
        )}

        {/* Reaction */}
        {msg.reaction_emoji && msg.message_type === 'reaction' && (
          <span className="text-2xl">{msg.reaction_emoji}</span>
        )}

        {/* Body */}
        {msg.body && msg.message_type !== 'reaction' && (
          <p className="text-sm whitespace-pre-wrap break-words">{msg.body}</p>
        )}

        {/* Time + status */}
        <div className={cn('flex items-center gap-1 mt-0.5', isOut ? 'justify-end' : 'justify-start')}>
          <span className="text-[10px] text-gray-400">{formatTime(msg.created_at)}</span>
          {isOut && <StatusIcon status={msg.status} />}
        </div>
      </div>
    </div>
  );
}

// ── Infinite Messages Hook ───────────────────────────────────────

function useInfiniteMessages(conversationId: string) {
  const [allMessages, setAllMessages] = useState<WaChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasNextPage, setHasNextPage] = useState(true);
  const oldestRef = useRef<string | undefined>();

  // Initial fetch
  useEffect(() => {
    setAllMessages([]);
    setHasNextPage(true);
    oldestRef.current = undefined;
    setIsLoading(true);
    waChatApi.listMessages(conversationId, { limit: 50 }).then(res => {
      setAllMessages(res.messages);
      setHasNextPage(res.messages.length >= 50);
      if (res.messages.length > 0) {
        oldestRef.current = res.messages[res.messages.length - 1].created_at;
      }
      setIsLoading(false);
    }).catch(() => setIsLoading(false));
  }, [conversationId]);

  const fetchNextPage = useCallback(() => {
    if (!hasNextPage || isLoading) return;
    setIsLoading(true);
    waChatApi.listMessages(conversationId, { limit: 50, before: oldestRef.current }).then(res => {
      setAllMessages(prev => [...prev, ...res.messages]);
      setHasNextPage(res.messages.length >= 50);
      if (res.messages.length > 0) {
        oldestRef.current = res.messages[res.messages.length - 1].created_at;
      }
      setIsLoading(false);
    }).catch(() => setIsLoading(false));
  }, [conversationId, hasNextPage, isLoading]);

  return { data: allMessages, isLoading, fetchNextPage, hasNextPage };
}

// ── Empty State ──────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-gray-400 dark:text-gray-500 bg-gray-50 dark:bg-gray-950">
      <div className="w-20 h-20 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mb-4">
        <MessageSquare size={36} className="text-green-500" />
      </div>
      <h3 className="text-xl font-semibold text-gray-600 dark:text-gray-300 mb-1">WhatsApp Live Chat</h3>
      <p className="text-sm max-w-xs text-center">
        Select a conversation from the left panel to start chatting
      </p>
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────────

function WhatsAppChatPage() {
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 400);
  const [selected, setSelected] = useState<WaChatConversation | null>(null);
  const [mobileShowChat, setMobileShowChat] = useState(false);

  const { data: convosData, isLoading } = useQuery({
    queryKey: ['wa-chat-conversations', debouncedSearch],
    queryFn: () => waChatApi.listConversations({ search: debouncedSearch || undefined }),
    refetchInterval: 10_000,
    staleTime: 5_000,
  });

  const conversations = convosData?.conversations ?? [];

  // Real-time: listen for new messages
  const queryClient = useQueryClient();
  const wsConnected = useAppStore(s => s.wsConnected);

  useEffect(() => {
    if (!wsConnected) return;

    const handler = (e: MessageEvent) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg.event === 'wa_chat:new_message' || msg.event === 'wa_chat:message_sent' || msg.event === 'wa_chat:status_update') {
          queryClient.invalidateQueries({ queryKey: ['wa-chat-conversations'] });
          if (selected) {
            queryClient.invalidateQueries({ queryKey: ['wa-chat-messages', selected.id] });
          }
        }
      } catch { /* ignore */ }
    };

    // We can't easily attach to the existing WS — do a refetch on interval instead
    // The real-time WS events already trigger via useRealtimeEvents → appStore
  }, [wsConnected, selected, queryClient]);

  const handleSelect = (c: WaChatConversation) => {
    setSelected(c);
    setMobileShowChat(true);
  };

  const handleBack = () => {
    setMobileShowChat(false);
  };

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col rounded-xl overflow-hidden border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm">
      {/* Business Header */}
      <BusinessHeader />
      
      {/* Main Chat Area */}
      <div className="flex flex-1 min-h-0">
        {/* Left panel */}
        <div className={cn('w-full md:w-[360px] flex-shrink-0', mobileShowChat && 'hidden md:flex md:flex-col')}>
          <ChatList
            conversations={conversations}
            selectedId={selected?.id ?? null}
            onSelect={handleSelect}
            search={search}
            onSearchChange={setSearch}
            isLoading={isLoading}
          />
        </div>

        {/* Right panel */}
        <div className={cn('flex-1 flex flex-col', !mobileShowChat && 'hidden md:flex')}>
          {selected ? (
            <MessagePanel conversation={selected} onBack={handleBack} />
          ) : (
            <EmptyState />
          )}
        </div>
      </div>
    </div>
  );
}

export default memo(WhatsAppChatPage);
