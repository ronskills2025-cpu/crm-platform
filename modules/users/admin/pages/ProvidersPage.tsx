import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Server, CheckCircle2, Settings2, RefreshCw } from 'lucide-react';
import { Link } from 'react-router-dom';
import { adminApi } from '../services/admin.api';
import { cn } from '../lib/utils';
import toast from 'react-hot-toast';

interface ProviderRecord {
  id: string;
  channel: string;
  name: string;
  display_name: string | null;
  is_active: boolean;
  status: string;
  status_message: string | null;
  priority: number;
  rate_per_sec: number;
}

function statusDot(status: string) {
  if (status === 'connected') return 'bg-emerald-500';
  if (status === 'failed') return 'bg-red-500';
  if (status === 'paused') return 'bg-yellow-500';
  return 'bg-gray-400';
}

export default function ProvidersPage() {
  const queryClient = useQueryClient();

  const { data: providersData } = useQuery({
    queryKey: ['admin-providers-all'],
    queryFn: () => adminApi.listProviders(),
    refetchInterval: 10_000,
  });

  const providers: ProviderRecord[] = providersData?.providers ?? [];

  const validateMutation = useMutation({
    mutationFn: (id: string) => adminApi.validateProvider(id),
    onSuccess: () => {
      toast.success('Validated');
      queryClient.invalidateQueries({ queryKey: ['admin-providers-all'] });
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Provider Overview</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">{providers.length} providers configured</p>
        </div>
        <button onClick={() => queryClient.invalidateQueries({ queryKey: ['admin-providers-all'] })}
          className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg">
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {providers.map((provider) => (
          <div key={provider.id} className="card">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className={cn('w-2.5 h-2.5 rounded-full', statusDot(provider.status))} />
                <h3 className="font-semibold text-sm">{provider.display_name || provider.name}</h3>
              </div>
              <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 uppercase">
                {provider.channel}
              </span>
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400 space-y-1 mb-3">
              <p>Status: <span className="font-medium text-gray-700 dark:text-gray-300">{provider.status}</span></p>
              <p>Priority: {provider.priority} | Rate: {provider.rate_per_sec}/sec</p>
              {provider.status_message && <p className="truncate">{provider.status_message}</p>}
            </div>
            <div className="flex gap-2">
              <button onClick={() => validateMutation.mutate(provider.id)}
                className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg text-xs bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-500/20">
                <CheckCircle2 className="w-3 h-3" /> Validate
              </button>
              <Link to="/channels"
                className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg text-xs bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700">
                <Settings2 className="w-3 h-3" /> Edit Full
              </Link>
            </div>
          </div>
        ))}
        {providers.length === 0 && (
          <div className="col-span-full text-center py-12 text-gray-500">
            <Server className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p>No providers configured yet</p>
            <Link to="/channels" className="text-brand-600 text-sm mt-2 inline-block hover:underline">Go to Channel Configuration →</Link>
          </div>
        )}
      </div>
    </div>
  );
}
