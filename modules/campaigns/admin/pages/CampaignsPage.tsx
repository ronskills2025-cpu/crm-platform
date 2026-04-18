import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle2, RefreshCw } from 'lucide-react';
import { adminApi } from '../services/admin.api';
import toast from 'react-hot-toast';

interface CampaignError {
  id: string;
  campaign_id: string;
  channel: string;
  recipient: string;
  provider: string | null;
  error_message: string;
  created_at: string;
}

export default function CampaignsPage() {
  const queryClient = useQueryClient();

  const { data: errorsData } = useQuery({
    queryKey: ['admin-campaign-errors'],
    queryFn: () => adminApi.getCampaignErrors({ limit: '50' }),
    refetchInterval: 10_000,
  });

  const campaignErrors: CampaignError[] = errorsData?.errors ?? [];

  async function retryCampaign(campaignId: string) {
    try {
      const result = await adminApi.retryCampaign(campaignId);
      toast.success(`Requeued ${result.requeued || 0} messages`);
      queryClient.invalidateQueries({ queryKey: ['admin-campaign-errors'] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Retry failed');
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Campaign Error Recovery</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">{campaignErrors.length} unresolved errors</p>
        </div>
        <button onClick={() => queryClient.invalidateQueries({ queryKey: ['admin-campaign-errors'] })}
          className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg">
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>

      {campaignErrors.length === 0 ? (
        <div className="card text-center py-12 text-gray-500">
          <CheckCircle2 className="w-10 h-10 mx-auto mb-3 opacity-30 text-emerald-500" />
          <p>No unresolved campaign errors</p>
        </div>
      ) : (
        <div className="space-y-3">
          {campaignErrors.map((err) => (
            <div key={err.id} className="card border-l-4 border-l-red-500">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0" />
                    <p className="font-medium text-sm">Campaign {err.campaign_id.slice(0, 8)}...</p>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 uppercase">{err.channel}</span>
                  </div>
                  <p className="text-sm text-gray-700 dark:text-gray-300">{err.error_message}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    To: {err.recipient} | Provider: {err.provider || 'n/a'} | {new Date(err.created_at).toLocaleString()}
                  </p>
                </div>
                <button onClick={() => retryCampaign(err.campaign_id)}
                  className="flex-shrink-0 btn-primary text-xs px-3 py-1.5">
                  <RefreshCw className="w-3 h-3 mr-1 inline" /> Retry
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
