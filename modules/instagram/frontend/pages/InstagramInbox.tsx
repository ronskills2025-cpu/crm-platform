import { useState, useMemo, memo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { MessageCircle, Send, Search, Check, Instagram } from 'lucide-react';
import { instagramApi } from '../../../../packages/ui/src/services/api';
import { useDebounce } from '../../../../packages/ui/src/hooks/useDebounce';
import toast from 'react-hot-toast';

export default memo(function InstagramInbox() {
  const queryClient = useQueryClient();
  const [selectedAccount, setSelectedAccount] = useState('');
  const [selectedConvo, setSelectedConvo] = useState<{ senderId: string; username: string | null } | null>(null);
  const [replyText, setReplyText] = useState('');
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search);

  const { data: accountsData } = useQuery({
    queryKey: ['instagram-accounts'],
    queryFn: () => instagramApi.listAccounts(),
  });
  const accounts = accountsData?.accounts ?? [];

  // Auto-select first account
  const activeAccountId = selectedAccount || (accounts[0]?.id as string) || '';

  const { data: convosData, isLoading: loadingConvos } = useQuery({
    queryKey: ['instagram-conversations', activeAccountId, debouncedSearch],
    queryFn: () => instagramApi.listConversations(activeAccountId, debouncedSearch ? { search: debouncedSearch } : undefined),
    enabled: !!activeAccountId,
    staleTime: 15_000,
    refetchInterval: 30_000,
  });
  const conversations = convosData?.conversations ?? [];

  const { data: messagesData, isLoading: loadingMessages } = useQuery({
    queryKey: ['instagram-messages', activeAccountId, selectedConvo?.senderId],
    queryFn: () => instagramApi.getConversation(activeAccountId, selectedConvo!.senderId),
    enabled: !!activeAccountId && !!selectedConvo,
    staleTime: 10_000,
    refetchInterval: 15_000,
  });
  const messages = messagesData?.messages ?? [];

  const sendMutation = useMutation({
    mutationFn: () => instagramApi.sendDM(activeAccountId, selectedConvo!.senderId, replyText),
    onSuccess: () => {
      toast.success('DM sent');
      setReplyText('');
      queryClient.invalidateQueries({ queryKey: ['instagram-messages'] });
      queryClient.invalidateQueries({ queryKey: ['instagram-conversations'] });
    },
    onError: () => toast.error('Failed to send DM'),
  });

  const markReadMutation = useMutation({
    mutationFn: (senderId: string) => instagramApi.markConversationRead(activeAccountId, senderId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['instagram-conversations'] }),
  });

  const handleSelectConvo = useCallback((senderId: string, username: string | null, unread: number) => {
    setSelectedConvo({ senderId, username });
    if (unread > 0) markReadMutation.mutate(senderId);
  }, [markReadMutation]);

  const handleSend = useCallback(() => {
    if (!replyText.trim()) return;
    sendMutation.mutate();
  }, [replyText, sendMutation]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-lg bg-gradient-to-br from-purple-600 to-pink-500">
          <MessageCircle className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Instagram Inbox</h1>
          <p className="text-gray-500 dark:text-gray-400">Manage DM conversations</p>
        </div>
        {accounts.length > 1 && (
          <select className="ml-auto input py-2 text-sm w-48" value={selectedAccount}
            onChange={(e) => { setSelectedAccount(e.target.value); setSelectedConvo(null); }}>
            {accounts.map((a: Record<string, unknown>) => (
              <option key={a.id as string} value={a.id as string}>@{a.ig_username as string}</option>
            ))}
          </select>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 h-[calc(100vh-200px)]">
        {/* Conversation List */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 flex flex-col overflow-hidden">
          <div className="p-3 border-b border-gray-200 dark:border-gray-700">
            <div className="relative">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
              <input className="input pl-9 py-2 text-sm w-full" placeholder="Search conversations..."
                value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {loadingConvos && <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-pink-500" /></div>}
            {!loadingConvos && conversations.length === 0 && (
              <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-8">No conversations</p>
            )}
            {conversations.map((c: Record<string, unknown>) => (
              <button key={c.sender_id as string}
                onClick={() => handleSelectConvo(c.sender_id as string, c.sender_username as string | null, c.unread as number)}
                className={`w-full text-left px-4 py-3 border-b border-gray-100 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors ${
                  selectedConvo?.senderId === c.sender_id ? 'bg-purple-50 dark:bg-purple-900/20' : ''
                }`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shrink-0">
                      <Instagram className="w-4 h-4 text-white" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-sm text-gray-900 dark:text-white truncate">
                        {c.sender_username ? `@${c.sender_username}` : c.sender_id as string}
                      </p>
                      <p className="text-xs text-gray-400 truncate">{c.last_message as string}</p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span className="text-xs text-gray-400">{new Date(c.last_at as string).toLocaleDateString()}</span>
                    {(c.unread as number) > 0 && (
                      <span className="px-1.5 py-0.5 bg-pink-500 text-white text-xs rounded-full min-w-[20px] text-center">
                        {c.unread as number}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Messages */}
        <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 flex flex-col overflow-hidden">
          {!selectedConvo ? (
            <div className="flex-1 flex items-center justify-center text-gray-400">
              <div className="text-center">
                <MessageCircle className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>Select a conversation to view messages</p>
              </div>
            </div>
          ) : (
            <>
              <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                  <Instagram className="w-4 h-4 text-white" />
                </div>
                <span className="font-medium text-gray-900 dark:text-white">
                  {selectedConvo.username ? `@${selectedConvo.username}` : selectedConvo.senderId}
                </span>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {loadingMessages && <div className="flex justify-center py-4"><div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-pink-500" /></div>}
                {messages.map((m: Record<string, unknown>) => (
                  <div key={m.id as string} className={`flex ${m.direction === 'outbound' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[70%] rounded-2xl px-4 py-2 ${
                      m.direction === 'outbound'
                        ? 'bg-gradient-to-br from-purple-600 to-pink-500 text-white'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white'
                    }`}>
                      <p className="text-sm whitespace-pre-wrap">{String(m.body)}</p>
                      <div className="flex items-center gap-1 mt-1">
                        <span className="text-[10px] opacity-70">{new Date(m.created_at as string).toLocaleTimeString()}</span>
                        {m.direction === 'outbound' && m.status === 'sent' && <Check className="w-3 h-3 opacity-70" />}
                        {!!m.is_automated && <span className="text-[10px] opacity-70 ml-1">⚡ auto</span>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="p-3 border-t border-gray-200 dark:border-gray-700">
                <div className="flex gap-2">
                  <input className="input flex-1 py-2 text-sm" placeholder="Type a message..."
                    value={replyText} onChange={(e) => setReplyText(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()} />
                  <button onClick={handleSend} disabled={sendMutation.isPending || !replyText.trim()}
                    className="btn bg-gradient-to-r from-purple-600 to-pink-500 text-white px-4 disabled:opacity-50">
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
