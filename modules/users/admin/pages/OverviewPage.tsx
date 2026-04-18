import { useQuery } from '@tanstack/react-query';
import { Users, Server, Activity, BarChart3, ChevronRight, Settings2, AlertTriangle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { adminApi } from '../services/admin.api';
import { useAuthStore } from '../stores/authStore';
import { cn } from '../lib/utils';

interface SystemOverview {
  users: { total: number };
  providers: { total: number; healthy: number };
  campaigns: { total: number; active: number };
  leads: { total: number };
}

function roleColor(role: string) {
  if (role === 'superadmin') return 'bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-300';
  if (role === 'admin') return 'bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300';
  return 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400';
}

export default function OverviewPage() {
  const user = useAuthStore((s) => s.user);

  const { data: overviewData, isLoading } = useQuery({
    queryKey: ['admin-overview'],
    queryFn: () => adminApi.getStats(),
    refetchInterval: 30_000,
  });

  const overview: SystemOverview | null = overviewData?.overview ?? overviewData ?? null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Dashboard Overview</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          Logged in as <span className="font-medium text-gray-700 dark:text-gray-200">{user?.email}</span>
          <span className={cn('ml-2 px-2 py-0.5 rounded-full text-xs font-medium', roleColor(user?.role ?? 'member'))}>{user?.role}</span>
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Users', value: overview?.users.total ?? 0, icon: Users, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-100 dark:bg-blue-500/10' },
          { label: 'Active Providers', value: `${overview?.providers.healthy ?? 0}/${overview?.providers.total ?? 0}`, icon: Server, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-100 dark:bg-emerald-500/10' },
          { label: 'Active Campaigns', value: overview?.campaigns.active ?? 0, icon: Activity, color: 'text-purple-600 dark:text-purple-400', bg: 'bg-purple-100 dark:bg-purple-500/10' },
          { label: 'Total Leads', value: overview?.leads.total ?? 0, icon: BarChart3, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-100 dark:bg-amber-500/10' },
        ].map((stat) => (
          <div key={stat.label} className="card">
            <div className="flex items-center gap-3">
              <div className={cn('p-2 rounded-lg', stat.bg)}>
                <stat.icon className={cn('w-5 h-5', stat.color)} />
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">{stat.label}</p>
                <p className="text-xl font-bold">{stat.value}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="card">
        <h3 className="font-semibold mb-4">Quick Actions</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {[
            { label: 'Manage Users', desc: 'Add, edit, or remove users', to: '/users', icon: Users },
            { label: 'Configure Providers', desc: 'Set up WhatsApp, SMS, Email', to: '/channels', icon: Settings2 },
            { label: 'Campaign Errors', desc: 'View and retry failed campaigns', to: '/campaigns', icon: AlertTriangle },
          ].map((action) => (
            <Link key={action.label} to={action.to}
              className="flex items-center gap-3 p-4 rounded-xl border border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors text-left">
              <action.icon className="w-5 h-5 text-brand-600" />
              <div className="flex-1">
                <p className="font-medium text-sm">{action.label}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{action.desc}</p>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-400" />
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
