import { useEffect, useState } from 'react';
import { Star, ThumbsUp, ThumbsDown, ExternalLink, TrendingUp, MessageSquare } from 'lucide-react';
import { reviewApi } from '../../../../packages/ui/src/services/api';

interface Review {
  id: string; customer_name: string | null; customer_phone: string;
  rating: number | null; feedback: string | null; status: string;
  google_review_url: string | null; redirect_sent: boolean;
  followup_count: number; created_at: string;
}
interface ReviewStats {
  total: number; pending: number; rated: number; redirected: number;
  escalated: number; noResponse: number; responseRate: number;
  avgRating: number; satisfactionScore: number;
  distribution: Record<number, number>;
}

function statusBadge(s: string) {
  const m: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
    rated: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    redirected: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
    escalated: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    no_response: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400',
  };
  return m[s] ?? m.pending;
}

function StarRow({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} className={`w-3.5 h-3.5 ${n <= rating ? 'fill-amber-400 text-amber-400' : 'text-gray-300'}`} />
      ))}
    </div>
  );
}

export default function ReviewCollectorPage() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [stats, setStats] = useState<ReviewStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');

  async function load() {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (statusFilter !== 'all') params.status = statusFilter;
      const [sd, rd] = await Promise.all([reviewApi.getStats(), reviewApi.list(params)]);
      setStats(sd.stats); setReviews(rd.reviews ?? []);
    } finally { setLoading(false); }
  }

  useEffect(() => { load(); }, [statusFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2"><Star className="w-6 h-6 text-brand-600" /> Review Collector</h1>
      </div>

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Avg Rating', value: stats.avgRating.toFixed(1), icon: Star, color: 'text-amber-500' },
            { label: 'Response Rate', value: `${stats.responseRate}%`, icon: TrendingUp, color: 'text-blue-500' },
            { label: 'Google Redirects', value: stats.redirected, icon: ExternalLink, color: 'text-emerald-500' },
            { label: 'Satisfaction', value: `${stats.satisfactionScore}%`, icon: ThumbsUp, color: 'text-violet-500' },
          ].map((c) => (
            <div key={c.label} className="rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-4">
              <div className="flex items-center gap-2 text-sm text-gray-500 mb-1"><c.icon className={`w-4 h-4 ${c.color}`} /> {c.label}</div>
              <p className="text-2xl font-bold">{c.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Rating distribution */}
      {stats && (
        <div className="rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-4">
          <h3 className="text-sm font-medium text-gray-500 mb-3">Rating Distribution</h3>
          <div className="space-y-2">
            {[5, 4, 3, 2, 1].map((n) => {
              const count = stats.distribution[n] ?? 0;
              const total = stats.total - stats.pending - stats.noResponse;
              const pct = total > 0 ? (count / total) * 100 : 0;
              return (
                <div key={n} className="flex items-center gap-3">
                  <span className="text-sm font-mono w-4">{n}</span>
                  <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                  <div className="flex-1 h-2 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
                    <div className="h-full rounded-full bg-amber-400" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-sm text-gray-500 w-8 text-right">{count}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="flex gap-2">
        {['all', 'pending', 'rated', 'redirected', 'escalated', 'no_response'].map((s) => (
          <button key={s} onClick={() => setStatusFilter(s)}
            className={`px-3 py-1 text-xs rounded-full border transition-colors ${statusFilter === s ? 'bg-brand-600 text-white border-brand-600' : 'border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'}`}>
            {s.replace('_', ' ').replace(/^\w/, c => c.toUpperCase())}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="animate-pulse space-y-3">{[...Array(5)].map((_, i) => <div key={i} className="h-12 rounded-lg bg-gray-200 dark:bg-gray-800" />)}</div>
      ) : reviews.length === 0 ? (
        <div className="text-center text-gray-500 py-12">No reviews yet. Send review requests to collect feedback.</div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-800">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-900">
              <tr>{['Customer', 'Phone', 'Rating', 'Feedback', 'Status', 'Follow-ups', 'Date'].map((h) => (
                <th key={h} className="px-4 py-3 text-left font-medium text-gray-500">{h}</th>
              ))}</tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
              {reviews.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  <td className="px-4 py-3 font-medium">{r.customer_name ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{r.customer_phone}</td>
                  <td className="px-4 py-3">{r.rating ? <StarRow rating={r.rating} /> : <span className="text-gray-400">—</span>}</td>
                  <td className="px-4 py-3 max-w-[200px] truncate">{r.feedback ?? '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusBadge(r.status)}`}>{r.status.replace('_', ' ')}</span>
                  </td>
                  <td className="px-4 py-3 text-center">{r.followup_count}</td>
                  <td className="px-4 py-3 text-gray-500">{new Date(r.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
