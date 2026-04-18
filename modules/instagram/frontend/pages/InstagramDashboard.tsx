import { memo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  Instagram, MessageCircle, MessageSquare, Users, BarChart3,
  TrendingUp, FileText, AlertCircle, Zap,
} from 'lucide-react';
import { instagramApi } from '../../../../packages/ui/src/services/api';
import toast from 'react-hot-toast';

function StatCard({ title, value, icon: Icon, color, sub }: {
  title: string; value: number | string; icon: React.ElementType; color: string; sub?: string;
}) {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
      <div className="flex items-center gap-3 mb-3">
        <div className={`p-2 rounded-lg ${color}`}><Icon className="w-5 h-5 text-white" /></div>
        <span className="text-sm text-gray-500 dark:text-gray-400">{title}</span>
      </div>
      <p className="text-2xl font-bold text-gray-900 dark:text-white">{typeof value === 'number' ? value.toLocaleString() : value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </motion.div>
  );
}

export default memo(function InstagramDashboard() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['instagram-stats'],
    queryFn: () => instagramApi.getStats(),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  const { data: accountsData } = useQuery({
    queryKey: ['instagram-accounts'],
    queryFn: () => instagramApi.listAccounts(),
    staleTime: 60_000,
    refetchInterval: 120_000,
  });

  const { data: logsData } = useQuery({
    queryKey: ['instagram-logs'],
    queryFn: () => instagramApi.listLogs({ limit: '10' }),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  const s = stats?.stats;
  const accounts = accountsData?.accounts ?? [];
  const logs = logsData?.logs ?? [];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-pink-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-lg bg-gradient-to-br from-purple-600 to-pink-500">
          <Instagram className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Instagram Automation</h1>
          <p className="text-gray-500 dark:text-gray-400">Comment-to-DM, Story Replies, Lead Bot, Content Studio</p>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Connected Accounts" value={s?.accounts ?? 0} icon={Instagram} color="bg-pink-600" />
        <StatCard title="Total DMs" value={s?.messages?.total ?? 0} icon={MessageCircle} color="bg-purple-600"
          sub={`${s?.messages?.inbound ?? 0} in · ${s?.messages?.outbound ?? 0} out · ${s?.messages?.automated ?? 0} auto`} />
        <StatCard title="Comments Processed" value={s?.comments?.total ?? 0} icon={MessageSquare} color="bg-blue-600"
          sub={`${s?.comments?.dmTriggered ?? 0} triggered DMs`} />
        <StatCard title="Total Leads" value={s?.leads?.total ?? 0} icon={Users} color="bg-emerald-600"
          sub={`🔴 ${s?.leads?.hot ?? 0} · 🟡 ${s?.leads?.warm ?? 0} · 🔵 ${s?.leads?.cold ?? 0}`} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Content Published" value={s?.content?.published ?? 0} icon={FileText} color="bg-orange-600"
          sub={`${s?.content?.scheduled ?? 0} scheduled`} />
        <StatCard title="Total Reach" value={s?.content?.totalReach ?? 0} icon={TrendingUp} color="bg-teal-600" />
        <StatCard title="Automation (24h)" value={s?.automationLast24h?.actions ?? 0} icon={Zap} color="bg-amber-600" />
        <StatCard title="Errors (24h)" value={s?.automationLast24h?.errors ?? 0} icon={AlertCircle}
          color={`${(s?.automationLast24h?.errors ?? 0) > 0 ? 'bg-red-600' : 'bg-gray-600'}`} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Connected Accounts */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
          <h2 className="font-semibold text-gray-900 dark:text-white mb-4">Connected Accounts</h2>
          <div className="space-y-3">
            {accounts.length === 0 && (
              <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">No accounts connected yet</p>
            )}
            {accounts.map((a: Record<string, unknown>) => (
              <div key={a.id as string} className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50">
                <div className="flex items-center gap-3">
                  {a.profile_pic_url ? (
                    <img src={a.profile_pic_url as string} alt="" className="w-10 h-10 rounded-full" />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                      <Instagram className="w-5 h-5 text-white" />
                    </div>
                  )}
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">@{a.ig_username as string}</p>
                    <p className="text-xs text-gray-400">ID: {a.ig_user_id as string}</p>
                  </div>
                </div>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                  a.is_active ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                    : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                }`}>
                  {a.is_active ? 'Active' : 'Inactive'}
                </span>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Recent Activity */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
          <h2 className="font-semibold text-gray-900 dark:text-white mb-4">Recent Activity</h2>
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {logs.length === 0 && (
              <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">No recent activity</p>
            )}
            {logs.map((l: Record<string, unknown>) => (
              <div key={l.id as string} className="flex items-start gap-3 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50">
                <div className={`mt-0.5 w-2 h-2 rounded-full shrink-0 ${
                  l.status === 'success' ? 'bg-emerald-500' : 'bg-red-500'
                }`} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-gray-700 dark:text-gray-300 truncate">{l.message as string}</p>
                  <p className="text-xs text-gray-400">{l.log_type as string} · {new Date(l.created_at as string).toLocaleString()}</p>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
});
