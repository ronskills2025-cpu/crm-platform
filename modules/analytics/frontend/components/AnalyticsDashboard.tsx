import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell, Legend } from 'recharts';
import { BarChart3, TrendingUp, PieChart as PieIcon, AlertCircle, Users, MessageSquare, DollarSign } from 'lucide-react';
import { analyticsApi } from '../analytics.api';
import { formatNumber, formatCurrency } from '../../../../packages/utils/src/frontend-utils';

const COLORS = ['#10b981', '#ef4444', '#f59e0b', '#6366f1', '#06b6d4', '#ec4899'];

export function AnalyticsDashboard() {
  const { data: summary, isLoading, isError } = useQuery({
    queryKey: ['analytics-summary'],
    queryFn: () => analyticsApi.getSummary(),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Analytics</h1>
          <p className="text-gray-400 mt-1">Loading performance metrics...</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm animate-pulse">
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2 mb-3" />
              <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-2" />
              <div className="h-3 bg-gray-100 dark:bg-gray-700 rounded w-1/3" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Analytics</h1>
          <p className="text-gray-400 mt-1">Performance metrics across all channels</p>
        </div>
        <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-xl p-6">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-6 h-6 text-red-500" />
            <div>
              <h3 className="font-semibold text-red-800 dark:text-red-200">Failed to load analytics data</h3>
              <p className="text-red-600 dark:text-red-400 text-sm mt-1">
                Please check that the backend is running and try refreshing the page.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const channels = summary?.channels || [];
  const leads = summary?.leads || { total: 0, new_today: 0, conversion_rate: 0 };
  const campaigns = summary?.campaigns || { total: 0, running: 0, delivery_rate: 0 };
  const revenue = summary?.revenue || { total_revenue: 0, payment_count: 0 };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Analytics</h1>
        <p className="text-gray-400 mt-1">Performance metrics across all channels</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">Total Messages</p>
            <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-blue-100 dark:bg-blue-900/30 text-blue-600">
              <MessageSquare size={18} />
            </div>
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">
            {formatNumber(channels.reduce((sum: number, ch: any) => sum + (ch.sent || 0), 0))}
          </p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
            {formatNumber(channels.reduce((sum: number, ch: any) => sum + (ch.delivered || 0), 0))} delivered
          </p>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">Total Leads</p>
            <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-green-100 dark:bg-green-900/30 text-green-600">
              <Users size={18} />
            </div>
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{formatNumber(leads.total)}</p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{leads.new_today} new today</p>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">Campaigns</p>
            <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-purple-100 dark:bg-purple-900/30 text-purple-600">
              <BarChart3 size={18} />
            </div>
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{formatNumber(campaigns.total)}</p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{campaigns.running} running</p>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">Revenue</p>
            <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600">
              <DollarSign size={18} />
            </div>
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{formatCurrency(revenue.total_revenue)}</p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{revenue.payment_count} payments</p>
        </motion.div>
      </div>

      {/* Channel Performance */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2 mb-4">
          <BarChart3 className="w-5 h-5 text-blue-600" />
          <h2 className="font-semibold">Channel Performance</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700">
                <th className="text-left py-2 font-medium text-gray-500 dark:text-gray-400">Channel</th>
                <th className="text-right py-2 font-medium text-gray-500 dark:text-gray-400">Sent</th>
                <th className="text-right py-2 font-medium text-gray-500 dark:text-gray-400">Delivered</th>
                <th className="text-right py-2 font-medium text-gray-500 dark:text-gray-400">Failed</th>
                <th className="text-right py-2 font-medium text-gray-500 dark:text-gray-400">Rate</th>
              </tr>
            </thead>
            <tbody>
              {channels.map((channel: any, index: number) => (
                <tr key={channel.channel} className="border-b border-gray-100 dark:border-gray-800 last:border-0">
                  <td className="py-3 font-medium capitalize">{channel.channel}</td>
                  <td className="text-right py-3">{formatNumber(channel.sent)}</td>
                  <td className="text-right py-3 text-green-600">{formatNumber(channel.delivered)}</td>
                  <td className="text-right py-3 text-red-600">{formatNumber(channel.failed)}</td>
                  <td className="text-right py-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      channel.delivery_rate >= 90 ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                      channel.delivery_rate >= 70 ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' :
                      'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                    }`}>
                      {channel.delivery_rate.toFixed(1)}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </motion.div>
    </div>
  );
}
