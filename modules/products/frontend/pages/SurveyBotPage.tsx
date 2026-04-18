import { useEffect, useState } from 'react';
import { ClipboardList, MessageSquare, TrendingUp, ThumbsUp, Minus, ThumbsDown, BarChart3, CheckCircle } from 'lucide-react';
import { surveyApi } from '../../../../packages/ui/src/services/api';

interface Survey {
  id: string; title: string; description: string | null;
  status: string; response_count: number; created_at: string;
}
interface SurveyStats {
  totalSurveys: number; activeSurveys: number;
  totalResponses: number; completed: number; pending: number;
  completionRate: number;
  sentimentBreakdown: { positive: number; neutral: number; negative: number };
}

function statusBadge(s: string) {
  const m: Record<string, string> = {
    draft: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400',
    active: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
    closed: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  };
  return m[s] ?? m.draft;
}

export default function SurveyBotPage() {
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [stats, setStats] = useState<SurveyStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');

  async function load() {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (statusFilter !== 'all') params.status = statusFilter;
      const [sd, sd2] = await Promise.all([surveyApi.getStats(), surveyApi.list(params)]);
      setStats(sd.stats); setSurveys(sd2.surveys ?? []);
    } finally { setLoading(false); }
  }

  useEffect(() => { load(); }, [statusFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  const sentTotal = stats ? stats.sentimentBreakdown.positive + stats.sentimentBreakdown.neutral + stats.sentimentBreakdown.negative : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2"><ClipboardList className="w-6 h-6 text-brand-600" /> Feedback Surveys</h1>
      </div>

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Active Surveys', value: stats.activeSurveys, icon: ClipboardList, color: 'text-emerald-500' },
            { label: 'Total Responses', value: stats.totalResponses, icon: MessageSquare, color: 'text-blue-500' },
            { label: 'Completion Rate', value: `${stats.completionRate}%`, icon: TrendingUp, color: 'text-violet-500' },
            { label: 'Completed', value: stats.completed, icon: CheckCircle, color: 'text-teal-500' },
          ].map((c) => (
            <div key={c.label} className="rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-4">
              <div className="flex items-center gap-2 text-sm text-gray-500 mb-1"><c.icon className={`w-4 h-4 ${c.color}`} /> {c.label}</div>
              <p className="text-2xl font-bold">{c.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Sentiment breakdown */}
      {stats && sentTotal > 0 && (
        <div className="rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-4">
          <h3 className="text-sm font-medium text-gray-500 mb-3">Sentiment Breakdown</h3>
          <div className="space-y-2">
            {[
              { label: 'Positive', count: stats.sentimentBreakdown.positive, icon: ThumbsUp, color: 'bg-emerald-400' },
              { label: 'Neutral', count: stats.sentimentBreakdown.neutral, icon: Minus, color: 'bg-yellow-400' },
              { label: 'Negative', count: stats.sentimentBreakdown.negative, icon: ThumbsDown, color: 'bg-red-400' },
            ].map((s) => (
              <div key={s.label} className="flex items-center gap-3">
                <s.icon className="w-4 h-4 text-gray-500" />
                <span className="text-sm w-16">{s.label}</span>
                <div className="flex-1 h-2 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
                  <div className={`h-full rounded-full ${s.color}`} style={{ width: `${(s.count / sentTotal) * 100}%` }} />
                </div>
                <span className="text-sm text-gray-500 w-8 text-right">{s.count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-2">
        {['all', 'draft', 'active', 'closed'].map((s) => (
          <button key={s} onClick={() => setStatusFilter(s)}
            className={`px-3 py-1 text-xs rounded-full border transition-colors ${statusFilter === s ? 'bg-brand-600 text-white border-brand-600' : 'border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'}`}>
            {s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="animate-pulse space-y-3">{[...Array(5)].map((_, i) => <div key={i} className="h-12 rounded-lg bg-gray-200 dark:bg-gray-800" />)}</div>
      ) : surveys.length === 0 ? (
        <div className="text-center text-gray-500 py-12">No surveys yet. Create your first survey to start collecting feedback.</div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-800">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-900">
              <tr>{['Title', 'Description', 'Status', 'Responses', 'Created'].map((h) => (
                <th key={h} className="px-4 py-3 text-left font-medium text-gray-500">{h}</th>
              ))}</tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {surveys.map((s) => (
                <tr key={s.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                  <td className="px-4 py-3 font-medium">{s.title}</td>
                  <td className="px-4 py-3 text-gray-500 truncate max-w-[200px]">{s.description ?? '—'}</td>
                  <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusBadge(s.status)}`}>{s.status}</span></td>
                  <td className="px-4 py-3 font-semibold">{s.response_count}</td>
                  <td className="px-4 py-3 text-gray-500">{new Date(s.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
