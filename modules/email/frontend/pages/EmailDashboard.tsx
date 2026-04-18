import { useState, useMemo, memo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Mail, RefreshCcw, Pause, Play, TrendingUp, XCircle, Eye, MousePointerClick, Search } from 'lucide-react';
import { emailApi, campaignApi } from '../../../../packages/ui/src/services/api';
import { StatsCard } from '../../../../packages/ui/src/components/shared/StatsCard';
import { ActivityFeed } from '../../../../packages/ui/src/components/shared/ActivityFeed';
import { useAppStore } from '../../../../packages/ui/src/stores/appStore';
import { cn, formatNumber } from '../../../../packages/utils/src/frontend-utils';
import toast from 'react-hot-toast';

export default memo(function EmailDashboard() {
  const queryClient = useQueryClient();
  const counters = useAppStore((s) => s.counters);
  const [search, setSearch] = useState('');

  const { data: campaigns } = useQuery({
    queryKey: ['campaigns', 'email'],
    queryFn: () => campaignApi.list({ channel: 'email' }),
    refetchInterval: 30_000,
  });

  const { data: providerStats } = useQuery({
    queryKey: ['email-providers'],
    queryFn: emailApi.getProviderStats,
    refetchInterval: 60_000,
  });

  const filteredCampaigns = useMemo(() => {
    const list = campaigns?.campaigns || [];
    if (!search) return list;
    const q = search.toLowerCase();
    return list.filter((c: Record<string, unknown>) =>
      (c.name as string)?.toLowerCase().includes(q) ||
      (c.status as string)?.toLowerCase().includes(q)
    );
  }, [campaigns, search]);

  const pauseMutation = useMutation({
    mutationFn: (id: string) => campaignApi.pause(id),
    onSuccess: () => { toast.success('Campaign paused'); queryClient.invalidateQueries({ queryKey: ['campaigns'] }); },
  });

  const resumeMutation = useMutation({
    mutationFn: (id: string) => campaignApi.resume(id),
    onSuccess: () => { toast.success('Campaign resumed'); queryClient.invalidateQueries({ queryKey: ['campaigns'] }); },
  });

  const retryMutation = useMutation({
    mutationFn: (id: string) => emailApi.retryFailed(id),
    onSuccess: (data) => toast.success(`Retrying ${data.retried} messages`),
  });

  const opens = providerStats?.stats?.filter(
    (s: Record<string, unknown>) => s.status === 'opened'
  ).reduce((acc: number, s: Record<string, unknown>) => acc + parseInt((s.count as string) || '0', 10), 0) || 0;

  const clicks = providerStats?.stats?.filter(
    (s: Record<string, unknown>) => s.status === 'clicked'
  ).reduce((acc: number, s: Record<string, unknown>) => acc + parseInt((s.count as string) || '0', 10), 0) || 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-lg bg-email"><Mail className="w-6 h-6 text-white" /></div>
        <div>
          <h1 className="text-2xl font-bold">Email</h1>
          <p className="text-gray-400">HTML templates with open & click tracking</p>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        <StatsCard title="Sent Today" value={counters.email.sent} icon={TrendingUp} color="bg-emerald-600" />
        <StatsCard title="Failed Today" value={counters.email.failed} icon={XCircle} color="bg-red-600" />
        <StatsCard title="In Queue" value={counters.email.queued} icon={Mail} color="bg-yellow-600" />
        <StatsCard title="Opens" value={opens} icon={Eye} color="bg-blue-600" />
        <StatsCard title="Clicks" value={clicks} icon={MousePointerClick} color="bg-purple-600" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold">Email Campaigns</h2>
            <div className="relative">
              <Search className="w-4 h-4 text-gray-500 absolute left-2.5 top-2.5" />
              <input className="input pl-8 py-2 text-sm w-48" placeholder="Search campaigns..." value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
          </div>
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {filteredCampaigns.length === 0 && <p className="text-sm text-gray-500 text-center py-4">No campaigns found</p>}
            {filteredCampaigns.map((c: Record<string, unknown>) => (
              <div key={c.id as string} className="flex items-center justify-between p-3 rounded-lg bg-gray-100 dark:bg-gray-800/50 hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors">
                <div>
                  <p className="font-medium">{c.name as string}</p>
                  <div className="flex items-center gap-3 text-xs text-gray-400 mt-1">
                    <span>Sent: {formatNumber((c.sent_count as number) || 0)}</span>
                    <span>Failed: {formatNumber((c.failed_count as number) || 0)}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={cn('badge', c.status === 'running' && 'badge-success', c.status === 'paused' && 'badge-warning', c.status === 'completed' && 'badge-info', c.status === 'failed' && 'badge-danger')}>{c.status as string}</span>
                  {c.status === 'running' && <button onClick={() => pauseMutation.mutate(c.id as string)} className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"><Pause className="w-4 h-4" /></button>}
                  {c.status === 'paused' && <button onClick={() => resumeMutation.mutate(c.id as string)} className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"><Play className="w-4 h-4" /></button>}
                  {((c.failed_count as number) || 0) > 0 && <button onClick={() => retryMutation.mutate(c.id as string)} className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded" title="Retry failed"><RefreshCcw className="w-4 h-4 text-yellow-400" /></button>}
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }} className="card">
          <h2 className="font-semibold mb-4">Provider Performance</h2>
          <div className="space-y-3">
            {providerStats?.stats?.map((s: Record<string, unknown>, i: number) => (
              <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-gray-100 dark:bg-gray-800/50">
                <div><p className="font-medium capitalize">{s.provider_used as string}</p><p className="text-xs text-gray-400">{s.status as string}</p></div>
                <span className="font-bold">{formatNumber(parseInt(s.count as string, 10) || 0)}</span>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      <ActivityFeed />
    </div>
  );
});
