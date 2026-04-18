import { useState, memo } from 'react';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, Search, Star, Tag, Trash2, Filter, BarChart2, MessageCircle, ChevronDown, ChevronRight } from 'lucide-react';
import { leadsApi } from '../../../../packages/ui/src/services/api';
import { cn, timeAgo, formatNumber } from '../../../../packages/utils/src/frontend-utils';
import { useDebounce } from '../../../../packages/ui/src/hooks/useDebounce';
import { Pagination } from '../../../../packages/ui/src/components/ui/Pagination';
import toast from 'react-hot-toast';

type Channel = 'whatsapp' | 'sms' | 'email' | 'telegram' | 'messenger' | 'instagram';
type Segment = 'hot' | 'warm' | 'cold';
type Status = 'new' | 'contacted' | 'converted' | 'lost';

const ALL_CHANNELS: Channel[] = ['whatsapp', 'sms', 'email', 'telegram', 'messenger', 'instagram'];
const ALL_STATUSES: Status[] = ['new', 'contacted', 'converted', 'lost'];

interface Lead {
  id: string;
  channel: Channel;
  contact_value: string;
  name: string | null;
  segment: Segment;
  status: Status;
  source: string | null;
  phone: string | null;
  email: string | null;
  tags: string[];
  is_vip: boolean;
  assigned_to: string | null;
  notes: string | null;
  response_count: number;
  last_contacted_at: string | null;
  created_at: string;
}

interface LeadStats {
  [channel: string]: {
    [segment: string]: { count: number; vip: number };
  };
}

const segmentColor: Record<Segment, string> = {
  hot: 'bg-red-500/20 text-red-300 border-red-500/30',
  warm: 'bg-orange-500/20 text-orange-300 border-orange-500/30',
  cold: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
};
const statusColor: Record<Status, string> = {
  new:       'bg-sky-500/20 text-sky-300 border-sky-500/30',
  contacted: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
  converted: 'bg-green-500/20 text-green-300 border-green-500/30',
  lost:      'bg-gray-500/20 text-gray-400 border-gray-500/30',
};
const channelColor: Record<Channel, string> = {
  whatsapp:  'text-emerald-400',
  sms:       'text-blue-400',
  email:     'text-purple-400',
  telegram:  'text-cyan-400',
  messenger: 'text-indigo-400',
  instagram: 'text-pink-400',
};

export default memo(function LeadsPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search);
  const [channelFilter, setChannelFilter] = useState<Channel | 'all'>('all');
  const [segmentFilter, setSegmentFilter] = useState<Segment | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<Status | 'all'>('all');
  const [vipOnly, setVipOnly] = useState(false);
  const [showConversations, setShowConversations] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [editNotes, setEditNotes] = useState('');
  const [editName, setEditName] = useState('');
  const [newTag, setNewTag] = useState('');
  const [showStats, setShowStats] = useState(false);
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 50;

  // ── Queries ────────────────────────────────────────────────────────────────
  const { data: leadsData, isLoading } = useQuery({
    queryKey: ['leads', channelFilter, segmentFilter, statusFilter, vipOnly, debouncedSearch, page],
    queryFn: () => leadsApi.list({
      channel: channelFilter !== 'all' ? channelFilter : undefined,
      segment: segmentFilter !== 'all' ? segmentFilter : undefined,
      status: statusFilter !== 'all' ? statusFilter : undefined,
      is_vip: vipOnly || undefined,
      search: debouncedSearch || undefined,
      limit: PAGE_SIZE,
      offset: page * PAGE_SIZE,
    }),
    staleTime: 30_000,
    refetchInterval: 60_000,
    placeholderData: keepPreviousData,
  });

  const { data: statsData, refetch: refetchStats } = useQuery({
    queryKey: ['leads-stats'],
    queryFn: () => leadsApi.getStats(),
    enabled: showStats,
  });

  const { data: conversationsData } = useQuery({
    queryKey: ['lead-conversations', selectedLead?.id],
    queryFn: () => leadsApi.getConversations(selectedLead!.id),
    enabled: !!selectedLead && showConversations,
    staleTime: 30_000,
  });

  const leads: Lead[] = (leadsData as any)?.leads ?? [];
  const totalLeads = (leadsData as any)?.total ?? leads.length;
  const stats: LeadStats = statsData?.stats ?? {};

  // ── Mutations ──────────────────────────────────────────────────────────────
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Lead> }) => leadsApi.update(id, data),
    onSuccess: (res) => {
      toast.success('Lead updated');
      setSelectedLead(res.lead);
      queryClient.invalidateQueries({ queryKey: ['leads'] });
    },
  });

  const setSegmentMutation = useMutation({
    mutationFn: ({ id, segment }: { id: string; segment: Segment }) => leadsApi.setSegment(id, segment),
    onSuccess: (res) => {
      toast.success('Segment updated');
      setSelectedLead(res.lead);
      queryClient.invalidateQueries({ queryKey: ['leads'] });
    },
  });

  const setStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: Status }) => leadsApi.setStatus(id, status),
    onSuccess: (res) => {
      toast.success('Status updated');
      setSelectedLead(res.lead);
      queryClient.invalidateQueries({ queryKey: ['leads'] });
    },
  });

  const tagMutation = useMutation({
    mutationFn: ({ id, tags, action }: { id: string; tags: string[]; action: 'add' | 'remove' }) => leadsApi.tag(id, tags, action),
    onSuccess: (res) => {
      setSelectedLead(res.lead);
      setNewTag('');
      queryClient.invalidateQueries({ queryKey: ['leads'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => leadsApi.delete(id),
    onSuccess: () => {
      toast.success('Lead deleted');
      setSelectedLead(null);
      queryClient.invalidateQueries({ queryKey: ['leads'] });
    },
  });

  // ── Stats totals ──────────────────────────────────────────────────────────
  const hotCount = leads.filter((l) => l.segment === 'hot').length;
  const warmCount = leads.filter((l) => l.segment === 'warm').length;
  const vipCount = leads.filter((l) => l.is_vip).length;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-lg bg-purple-500/10"><Users className="w-6 h-6 text-purple-400" /></div>
        <div>
          <h1 className="text-2xl font-bold">Leads</h1>
          <p className="text-gray-500 dark:text-gray-400">{formatNumber(totalLeads)} leads · {hotCount} hot · {vipCount} VIP</p>
        </div>
        <button onClick={() => { setShowStats(!showStats); if (!showStats) refetchStats(); }}
          className={cn('ml-auto p-2 rounded-lg transition-colors', showStats ? 'bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200' : 'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400')}>
          <BarChart2 className="w-5 h-5" />
        </button>
      </div>

      {/* Stats Panel */}
      <AnimatePresence>
        {showStats && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {ALL_CHANNELS.map((ch) => {
                const chStats = stats[ch] ?? {};
                const total = Object.values(chStats).reduce((s, v) => (s as number) + (v as any).count, 0) as number;
                return (
                  <div key={ch} className="card p-3">
                    <p className={cn('text-xs font-medium capitalize mb-2', channelColor[ch])}>{ch}</p>
                    {(['hot', 'warm', 'cold'] as Segment[]).map((seg) => (
                      <div key={seg} className="flex justify-between text-xs mb-1">
                        <span className={cn('capitalize', seg === 'hot' ? 'text-red-400' : seg === 'warm' ? 'text-orange-400' : 'text-blue-400')}>{seg}</span>
                        <span className="text-gray-400">{(chStats as any)[seg]?.count ?? 0}</span>
                      </div>
                    ))}
                    <div className="border-t border-gray-200 dark:border-gray-800 mt-2 pt-2 flex justify-between text-xs">
                      <span className="text-gray-500">Total</span><span>{total}</span>
                    </div>
                  </div>
                );
              })}
              <div className="card p-3">
                <p className="text-xs font-medium text-yellow-400 mb-2">⭐ VIP</p>
                <p className="text-2xl font-bold">{vipCount}</p>
                <p className="text-xs text-gray-500 mt-1">across all channels</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap items-center">
        <div className="relative flex-1 min-w-48 max-w-sm">
          <Search className="w-4 h-4 text-gray-500 absolute left-3 top-2.5" />
          <input className="input pl-9 py-2 text-sm w-full" placeholder="Search name, contact…" value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} />
        </div>
        <div className="flex gap-1 flex-wrap">
          {(['all', ...ALL_CHANNELS] as const).map((c) => (
            <button key={c} onClick={() => { setChannelFilter(c as Channel | 'all'); setPage(0); }}
              className={cn('px-3 py-1.5 rounded text-xs font-medium capitalize transition-colors',
                channelFilter === c ? 'bg-brand-600 text-white' : 'text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700'
              )}>{c}</button>
          ))}
        </div>
        <div className="flex gap-1">
          {(['all', 'hot', 'warm', 'cold'] as const).map((s) => (
            <button key={s} onClick={() => { setSegmentFilter(s); setPage(0); }}
              className={cn('px-3 py-1.5 rounded text-xs font-medium capitalize transition-colors',
                segmentFilter === s ? 'bg-brand-600 text-white' : 'text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700'
              )}>{s}</button>
          ))}
        </div>
        <div className="flex gap-1">
          {(['all', ...ALL_STATUSES] as const).map((s) => (
            <button key={s} onClick={() => { setStatusFilter(s as Status | 'all'); setPage(0); }}
              className={cn('px-3 py-1.5 rounded text-xs font-medium capitalize transition-colors',
                statusFilter === s ? 'bg-brand-600 text-white' : 'text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700'
              )}>{s}</button>
          ))}
        </div>
        <button onClick={() => { setVipOnly(!vipOnly); setPage(0); }}
          className={cn('flex items-center gap-1 px-3 py-1.5 rounded text-xs font-medium transition-colors',
            vipOnly ? 'bg-yellow-500/20 text-yellow-600 dark:text-yellow-300' : 'text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700'
          )}>
          <Star className="w-3.5 h-3.5" /> VIP
        </button>
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Lead List */}
        <div className="lg:col-span-2 card overflow-hidden">
          <div className="p-3 border-b border-gray-200 dark:border-gray-800 text-sm text-gray-500 dark:text-gray-400 flex items-center gap-2">
            <Filter className="w-3.5 h-3.5" />
            <span>{formatNumber(totalLeads)} leads</span>
            {(channelFilter !== 'all' || segmentFilter !== 'all' || statusFilter !== 'all' || vipOnly || search) && (
              <button onClick={() => { setChannelFilter('all'); setSegmentFilter('all'); setStatusFilter('all'); setVipOnly(false); setSearch(''); setPage(0); }}
                className="ml-auto text-xs text-brand-400 hover:text-brand-300">Clear filters</button>
            )}
          </div>
          <div className="overflow-y-auto max-h-[600px]">
            {isLoading && <p className="text-center text-gray-500 py-8 text-sm">Loading…</p>}
            {!isLoading && leads.length === 0 && <p className="text-center text-gray-500 py-8 text-sm">No leads match your filters</p>}
            <AnimatePresence>
              {leads.map((lead) => (
                <motion.button key={lead.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  onClick={() => { setSelectedLead(lead); setEditNotes(lead.notes ?? ''); setEditName(lead.name ?? ''); }}
                  className={cn('w-full text-left px-4 py-3 border-b border-gray-200/50 dark:border-gray-800/50 hover:bg-gray-100/50 dark:hover:bg-gray-800/40 transition-colors',
                    selectedLead?.id === lead.id && 'bg-gray-100 dark:bg-gray-800',
                    lead.is_vip && 'border-l-2 border-l-yellow-400'
                  )}>
                  <div className="flex items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        {lead.is_vip && <Star className="w-3.5 h-3.5 text-yellow-400 fill-yellow-400 flex-shrink-0" />}
                        <span className="font-medium text-sm text-gray-800 dark:text-gray-200 truncate">{lead.name || lead.contact_value}</span>
                        <span className={cn('text-xs px-1.5 py-0.5 rounded-full border', segmentColor[lead.segment])}>{lead.segment}</span>
                        <span className={cn('text-xs px-1.5 py-0.5 rounded-full border', statusColor[lead.status ?? 'new'])}>{lead.status ?? 'new'}</span>
                        <span className={cn('text-xs', channelColor[lead.channel])}>{lead.channel}</span>
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">{lead.contact_value}</p>
                      {lead.tags.length > 0 && (
                        <div className="flex gap-1 mt-1 flex-wrap">
                          {lead.tags.slice(0, 3).map((t) => <span key={t} className="text-xs px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400">{t}</span>)}
                          {lead.tags.length > 3 && <span className="text-xs text-gray-600">+{lead.tags.length - 3}</span>}
                        </div>
                      )}
                    </div>
                    <div className="text-xs text-gray-600 text-right flex-shrink-0">
                      <div>{lead.response_count} msgs</div>
                      {lead.last_contacted_at && <div className="mt-0.5">{timeAgo(new Date(lead.last_contacted_at).getTime())}</div>}
                    </div>
                  </div>
                </motion.button>
              ))}
            </AnimatePresence>
          </div>
          <Pagination page={page} pageSize={PAGE_SIZE} total={totalLeads} onPageChange={setPage} />
        </div>

        {/* Lead Detail */}
        <div className="card p-4">
          {!selectedLead ? (
            <div className="flex items-center justify-center h-40 text-gray-600">
              <div className="text-center">
                <Users className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">Select a lead</p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    {selectedLead.is_vip && <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />}
                    <h3 className="font-semibold text-gray-200">{selectedLead.name || selectedLead.contact_value}</h3>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">{selectedLead.contact_value}</p>
                  <span className={cn('text-xs', channelColor[selectedLead.channel])}>{selectedLead.channel}</span>
                </div>
                <button onClick={() => { if (confirm('Delete this lead?')) deleteMutation.mutate(selectedLead.id); }}
                  className="p-1.5 hover:text-red-400 text-gray-600">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              {/* Name edit */}
              <div>
                <label className="label text-xs">Name</label>
                <div className="flex gap-2">
                  <input className="input flex-1 py-1.5 text-sm" value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="Display name…" />
                  <button className="btn-secondary text-xs px-2.5 py-1.5" onClick={() => updateMutation.mutate({ id: selectedLead.id, data: { name: editName } })}>Save</button>
                </div>
              </div>

              {/* Segment */}
              <div>
                <label className="label text-xs">Segment</label>
                <div className="flex gap-1.5">
                  {(['hot', 'warm', 'cold'] as Segment[]).map((s) => (
                    <button key={s} onClick={() => setSegmentMutation.mutate({ id: selectedLead.id, segment: s })}
                      className={cn('flex-1 py-1.5 rounded-lg text-xs font-medium capitalize border transition-all',
                        selectedLead.segment === s ? segmentColor[s] : 'bg-gray-100 dark:bg-gray-800 text-gray-500 border-transparent hover:bg-gray-200 dark:hover:bg-gray-700'
                      )}>{s}</button>
                  ))}
                </div>
              </div>

              {/* Status */}
              <div>
                <label className="label text-xs">Status</label>
                <div className="grid grid-cols-2 gap-1.5">
                  {ALL_STATUSES.map((s) => (
                    <button key={s} onClick={() => setStatusMutation.mutate({ id: selectedLead.id, status: s })}
                      className={cn('py-1.5 rounded-lg text-xs font-medium capitalize border transition-all',
                        (selectedLead.status ?? 'new') === s ? statusColor[s] : 'bg-gray-100 dark:bg-gray-800 text-gray-500 border-transparent hover:bg-gray-200 dark:hover:bg-gray-700'
                      )}>{s}</button>
                  ))}
                </div>
              </div>

              {/* VIP toggle */}
              <div className="flex items-center justify-between">
                <label className="label text-xs mb-0">VIP Status</label>
                <button onClick={() => updateMutation.mutate({ id: selectedLead.id, data: { is_vip: !selectedLead.is_vip } })}
                  className={cn('flex items-center gap-1.5 text-xs px-3 py-1 rounded-full border transition-all',
                    selectedLead.is_vip ? 'bg-yellow-500/20 border-yellow-500/40 text-yellow-300' : 'bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                  )}>
                  <Star className={cn('w-3.5 h-3.5', selectedLead.is_vip && 'fill-yellow-300')} />
                  {selectedLead.is_vip ? 'VIP' : 'Set VIP'}
                </button>
              </div>

              {/* Tags */}
              <div>
                <label className="label text-xs">Tags</label>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {selectedLead.tags.map((tag) => (
                    <span key={tag} className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-xs">
                      {tag}
                      <button onClick={() => tagMutation.mutate({ id: selectedLead.id, tags: [tag], action: 'remove' })} className="hover:text-red-400">×</button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input className="input flex-1 py-1 text-xs" placeholder="New tag…" value={newTag} onChange={(e) => setNewTag(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && newTag.trim()) tagMutation.mutate({ id: selectedLead.id, tags: [newTag.trim()], action: 'add' }); }} />
                  <button onClick={() => newTag.trim() && tagMutation.mutate({ id: selectedLead.id, tags: [newTag.trim()], action: 'add' })}
                    className="p-1.5 bg-gray-200 dark:bg-gray-700 rounded hover:bg-gray-300 dark:hover:bg-gray-600" disabled={!newTag.trim()}>
                    <Tag className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="label text-xs">Notes</label>
                <textarea className="input w-full text-xs py-1.5" rows={3} value={editNotes} onChange={(e) => setEditNotes(e.target.value)} placeholder="Internal notes…" />
                <button className="btn-secondary text-xs mt-1 w-full py-1.5"
                  onClick={() => updateMutation.mutate({ id: selectedLead.id, data: { notes: editNotes } })}>Save Notes</button>
              </div>

              {/* Stats */}
              <div className="text-xs text-gray-500 space-y-1 pt-2 border-t border-gray-200 dark:border-gray-800">
                <div className="flex justify-between"><span>Responses</span><span className="text-gray-400">{selectedLead.response_count}</span></div>
                {selectedLead.source && <div className="flex justify-between"><span>Source</span><span className="text-gray-400 capitalize">{selectedLead.source}</span></div>}
                {selectedLead.phone && <div className="flex justify-between"><span>Phone</span><span className="text-gray-400">{selectedLead.phone}</span></div>}
                {selectedLead.email && <div className="flex justify-between"><span>Email</span><span className="text-gray-400 truncate ml-2">{selectedLead.email}</span></div>}
                {selectedLead.assigned_to && <div className="flex justify-between"><span>Assigned to</span><span className="text-gray-400 truncate ml-2">{selectedLead.assigned_to}</span></div>}
                {selectedLead.last_contacted_at && <div className="flex justify-between"><span>Last contact</span><span className="text-gray-400">{timeAgo(new Date(selectedLead.last_contacted_at).getTime())}</span></div>}
                <div className="flex justify-between"><span>Added</span><span className="text-gray-400">{timeAgo(new Date(selectedLead.created_at).getTime())}</span></div>
              </div>

              {/* Conversation History */}
              <div className="pt-2 border-t border-gray-200 dark:border-gray-800">
                <button
                  onClick={() => setShowConversations(!showConversations)}
                  className="flex items-center gap-2 text-xs font-medium text-gray-400 hover:text-gray-200 w-full"
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  <span>Conversation History</span>
                  {showConversations ? <ChevronDown className="w-3.5 h-3.5 ml-auto" /> : <ChevronRight className="w-3.5 h-3.5 ml-auto" />}
                </button>
                {showConversations && (
                  <div className="mt-2 space-y-3 max-h-64 overflow-y-auto">
                    {!conversationsData && <p className="text-xs text-gray-600 py-2 text-center">Loading…</p>}
                    {conversationsData?.threads?.length === 0 && <p className="text-xs text-gray-600 py-2 text-center">No conversations yet</p>}
                    {(conversationsData?.threads ?? []).map((thread: any) => (
                      <div key={thread.id} className="text-xs space-y-1">
                        <p className="text-gray-500 capitalize font-medium">{thread.channel} · {timeAgo(new Date(thread.last_message_at).getTime())}</p>
                        {(thread.messages ?? []).slice(-3).map((msg: any) => (
                          <div key={msg.id} className={cn('px-2 py-1 rounded text-xs',
                            msg.direction === 'inbound' ? 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300' : 'bg-brand-600/20 text-brand-300 ml-4'
                          )}>
                            {msg.body}
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
});
