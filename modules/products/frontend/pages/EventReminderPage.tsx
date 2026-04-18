import { useEffect, useState } from 'react';
import { CalendarCheck, Users, Clock, CheckCircle, XCircle, TrendingUp, Bell, MapPin } from 'lucide-react';
import { eventApi } from '../../../../packages/ui/src/services/api';

interface EventRecord {
  id: string; title: string; description: string | null;
  event_date: string; event_time: string | null;
  location: string | null; event_url: string | null;
  max_attendees: number | null; status: string;
  created_at: string;
}
interface EventStats {
  totalEvents: number; upcoming: number; completed: number;
  totalRegistrations: number; confirmed: number; attended: number;
  missed: number; attendanceRate: number;
}

function statusBadge(s: string) {
  const m: Record<string, string> = {
    draft: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400',
    upcoming: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    live: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
    completed: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400',
    cancelled: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  };
  return m[s] ?? m.draft;
}

export default function EventReminderPage() {
  const [events, setEvents] = useState<EventRecord[]>([]);
  const [stats, setStats] = useState<EventStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');

  async function load() {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (statusFilter !== 'all') params.status = statusFilter;
      const [sd, ed] = await Promise.all([eventApi.getStats(), eventApi.list(params)]);
      setStats(sd.stats); setEvents(ed.events ?? []);
    } finally { setLoading(false); }
  }

  useEffect(() => { load(); }, [statusFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2"><CalendarCheck className="w-6 h-6 text-brand-600" /> Event Reminder</h1>
      </div>

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Total Events', value: stats.totalEvents, icon: CalendarCheck, color: 'text-blue-500' },
            { label: 'Upcoming', value: stats.upcoming, icon: Clock, color: 'text-amber-500' },
            { label: 'Registrations', value: stats.totalRegistrations, icon: Users, color: 'text-violet-500' },
            { label: 'Attendance Rate', value: `${stats.attendanceRate}%`, icon: TrendingUp, color: 'text-emerald-500' },
          ].map((c) => (
            <div key={c.label} className="rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-4">
              <div className="flex items-center gap-2 text-sm text-gray-500 mb-1"><c.icon className={`w-4 h-4 ${c.color}`} /> {c.label}</div>
              <p className="text-2xl font-bold">{c.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Breakdown */}
      {stats && (
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Confirmed', value: stats.confirmed, icon: CheckCircle, color: 'text-blue-500' },
            { label: 'Attended', value: stats.attended, icon: Users, color: 'text-emerald-500' },
            { label: 'Missed', value: stats.missed, icon: XCircle, color: 'text-red-500' },
          ].map((c) => (
            <div key={c.label} className="rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-4">
              <div className="flex items-center gap-2 text-sm text-gray-500 mb-1"><c.icon className={`w-4 h-4 ${c.color}`} /> {c.label}</div>
              <p className="text-xl font-bold">{c.value}</p>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        {['all', 'draft', 'upcoming', 'live', 'completed', 'cancelled'].map((s) => (
          <button key={s} onClick={() => setStatusFilter(s)}
            className={`px-3 py-1 text-xs rounded-full border transition-colors ${statusFilter === s ? 'bg-brand-600 text-white border-brand-600' : 'border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'}`}>
            {s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="animate-pulse space-y-3">{[...Array(5)].map((_, i) => <div key={i} className="h-12 rounded-lg bg-gray-200 dark:bg-gray-800" />)}</div>
      ) : events.length === 0 ? (
        <div className="text-center text-gray-500 py-12">No events yet. Create your first event to start sending reminders.</div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-800">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-900">
              <tr>{['Title', 'Date', 'Time', 'Location', 'Max Attendees', 'Status', 'Created'].map((h) => (
                <th key={h} className="px-4 py-3 text-left font-medium text-gray-500">{h}</th>
              ))}</tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {events.map((e) => (
                <tr key={e.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                  <td className="px-4 py-3 font-medium">{e.title}</td>
                  <td className="px-4 py-3">{new Date(e.event_date).toLocaleDateString()}</td>
                  <td className="px-4 py-3">{e.event_time ?? '—'}</td>
                  <td className="px-4 py-3">{e.location ? <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{e.location}</span> : '—'}</td>
                  <td className="px-4 py-3">{e.max_attendees ?? '∞'}</td>
                  <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusBadge(e.status)}`}>{e.status}</span></td>
                  <td className="px-4 py-3 text-gray-500">{new Date(e.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
