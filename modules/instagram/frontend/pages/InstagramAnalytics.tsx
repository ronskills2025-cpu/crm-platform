import { useState, memo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  BarChart3, TrendingUp, MessageCircle, MessageSquare, Users,
  FileText, Zap, ArrowUp, ArrowDown,
} from 'lucide-react';
import { instagramApi } from '../../../../packages/ui/src/services/api';

function MetricCard({ title, value, icon: Icon, color, change }: {
  title: string; value: number | string; icon: React.ElementType; color: string; change?: number;
}) {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm text-gray-500 dark:text-gray-400">{title}</span>
        <div className={`p-2 rounded-lg ${color}`}><Icon className="w-4 h-4 text-white" /></div>
      </div>
      <p className="text-2xl font-bold text-gray-900 dark:text-white">{typeof value === 'number' ? value.toLocaleString() : value}</p>
      {change !== undefined && (
        <div className={`flex items-center gap-1 mt-1 text-xs ${change >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
          {change >= 0 ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
          <span>{Math.abs(change)}%</span>
        </div>
      )}
    </motion.div>
  );
}

export default memo(function InstagramAnalytics() {
  const [timeRange, setTimeRange] = useState('7d');

  const { data: stats, isLoading } = useQuery({
    queryKey: ['instagram-stats'],
    queryFn: () => instagramApi.getStats(),
    refetchInterval: 30_000,
  });

  const { data: logsData } = useQuery({
    queryKey: ['instagram-logs-analytics'],
    queryFn: () => instagramApi.listLogs({ limit: '50' }),
  });

  const s = stats?.stats;
  const logs = logsData?.logs ?? [];

  // Group logs by type for distribution
  const logTypes: Record<string, number> = {};
  for (const l of logs) {
    const t = l.log_type as string;
    logTypes[t] = (logTypes[t] ?? 0) + 1;
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-pink-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-indigo-600"><BarChart3 className="w-6 h-6 text-white" /></div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Instagram Analytics</h1>
            <p className="text-gray-500 dark:text-gray-400">Performance metrics and insights</p>
          </div>
        </div>
        <select className="input py-2 text-sm" value={timeRange} onChange={(e) => setTimeRange(e.target.value)}>
          <option value="24h">Last 24 hours</option>
          <option value="7d">Last 7 days</option>
          <option value="30d">Last 30 days</option>
          <option value="all">All time</option>
        </select>
      </div>

      {/* Top Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard title="Total Messages" value={s?.messages?.total ?? 0} icon={MessageCircle} color="bg-purple-600" />
        <MetricCard title="Automated DMs" value={s?.messages?.automated ?? 0} icon={Zap} color="bg-pink-600" />
        <MetricCard title="Comments Processed" value={s?.comments?.total ?? 0} icon={MessageSquare} color="bg-blue-600" />
        <MetricCard title="DMs Triggered" value={s?.comments?.dmTriggered ?? 0} icon={TrendingUp} color="bg-emerald-600" />
      </div>

      {/* Lead & Content Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard title="Total Leads" value={s?.leads?.total ?? 0} icon={Users} color="bg-amber-600" />
        <MetricCard title="Hot Leads" value={s?.leads?.hot ?? 0} icon={TrendingUp} color="bg-red-600" />
        <MetricCard title="Content Published" value={s?.content?.published ?? 0} icon={FileText} color="bg-teal-600" />
        <MetricCard title="Total Reach" value={s?.content?.totalReach ?? 0} icon={BarChart3} color="bg-indigo-600" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Lead Funnel */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
          <h2 className="font-semibold text-gray-900 dark:text-white mb-4">Lead Funnel</h2>
          <div className="space-y-3">
            {[
              { label: 'Total', value: s?.leads?.total ?? 0, color: 'bg-gray-500', width: 100 },
              { label: 'Completed', value: s?.leads?.completed ?? 0, color: 'bg-emerald-500', width: Math.round(((s?.leads?.completed ?? 0) / Math.max(s?.leads?.total ?? 1, 1)) * 100) },
              { label: 'Hot', value: s?.leads?.hot ?? 0, color: 'bg-red-500', width: Math.round(((s?.leads?.hot ?? 0) / Math.max(s?.leads?.total ?? 1, 1)) * 100) },
              { label: 'Warm', value: s?.leads?.warm ?? 0, color: 'bg-yellow-500', width: Math.round(((s?.leads?.warm ?? 0) / Math.max(s?.leads?.total ?? 1, 1)) * 100) },
              { label: 'Cold', value: s?.leads?.cold ?? 0, color: 'bg-blue-500', width: Math.round(((s?.leads?.cold ?? 0) / Math.max(s?.leads?.total ?? 1, 1)) * 100) },
              { label: 'Dropped', value: s?.leads?.dropped ?? 0, color: 'bg-gray-400', width: Math.round(((s?.leads?.dropped ?? 0) / Math.max(s?.leads?.total ?? 1, 1)) * 100) },
            ].map(item => (
              <div key={item.label}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-600 dark:text-gray-400">{item.label}</span>
                  <span className="font-medium text-gray-900 dark:text-white">{item.value}</span>
                </div>
                <div className="h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                  <motion.div initial={{ width: 0 }} animate={{ width: `${item.width}%` }}
                    transition={{ duration: 0.8 }}
                    className={`h-full rounded-full ${item.color}`} />
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Content Performance */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
          <h2 className="font-semibold text-gray-900 dark:text-white mb-4">Content Performance</h2>
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{(s?.content?.totalLikes ?? 0).toLocaleString()}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Total Likes</p>
              </div>
              <div className="text-center p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{(s?.content?.totalComments ?? 0).toLocaleString()}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Total Comments</p>
              </div>
              <div className="text-center p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{(s?.content?.totalReach ?? 0).toLocaleString()}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Total Reach</p>
              </div>
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Published: {s?.content?.published ?? 0} | Scheduled: {s?.content?.scheduled ?? 0} | Total: {s?.content?.total ?? 0}</p>
            </div>
          </div>

          <h3 className="font-medium text-gray-900 dark:text-white mt-6 mb-3">Automation Activity (Last 50 Events)</h3>
          <div className="space-y-2">
            {Object.entries(logTypes).length === 0 && (
              <p className="text-sm text-gray-500 dark:text-gray-400">No automation events recorded</p>
            )}
            {Object.entries(logTypes).sort(([, a], [, b]) => b - a).map(([type, count]) => (
              <div key={type} className="flex items-center justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">{type.replace(/_/g, ' ')}</span>
                <span className="font-medium text-gray-900 dark:text-white px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded">
                  {count}
                </span>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Message Distribution */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
        className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
        <h2 className="font-semibold text-gray-900 dark:text-white mb-4">Message Distribution</h2>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div className="text-center p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
            <p className="text-3xl font-bold text-purple-600 dark:text-purple-400">{(s?.messages?.total ?? 0).toLocaleString()}</p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Total Messages</p>
          </div>
          <div className="text-center p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">{(s?.messages?.inbound ?? 0).toLocaleString()}</p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Inbound</p>
          </div>
          <div className="text-center p-4 bg-pink-50 dark:bg-pink-900/20 rounded-lg">
            <p className="text-3xl font-bold text-pink-600 dark:text-pink-400">{(s?.messages?.outbound ?? 0).toLocaleString()}</p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Outbound</p>
          </div>
          <div className="text-center p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
            <p className="text-3xl font-bold text-amber-600 dark:text-amber-400">{(s?.messages?.automated ?? 0).toLocaleString()}</p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Automated</p>
          </div>
        </div>
      </motion.div>
    </div>
  );
});
