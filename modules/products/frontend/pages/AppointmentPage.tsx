import { useEffect, useState } from 'react';
import { Calendar, Clock, Users, CheckCircle, Plus, XCircle } from 'lucide-react';
import { appointmentApi } from '../../../../packages/ui/src/services/api';

interface BookingService { id: string; name: string; duration_min: number; price: number; currency: string; location: string | null; is_active: boolean; }
interface Booking { id: string; service_id: string; customer_name: string | null; customer_phone: string; booking_date: string; start_time: string; status: string; notes: string | null; reminder_sent: boolean; created_at: string; }
interface AppStats { total: number; confirmed: number; completed: number; cancelled: number; noShow: number; totalRevenue: number; }

function statusBadge(s: string) {
  const m: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
    confirmed: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    completed: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
    cancelled: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400',
    no_show: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  };
  return m[s] ?? m.pending;
}

export default function AppointmentPage() {
  const [services, setServices] = useState<BookingService[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [stats, setStats] = useState<AppStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'bookings' | 'services'>('bookings');
  const [statusFilter, setStatusFilter] = useState('all');

  async function load() {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (statusFilter !== 'all') params.status = statusFilter;
      const [sd, svcs, bks] = await Promise.all([
        appointmentApi.getStats(), appointmentApi.listServices(), appointmentApi.listBookings(params),
      ]);
      setStats(sd.stats); setServices(svcs.services ?? []); setBookings(bks.bookings ?? []);
    } finally { setLoading(false); }
  }

  useEffect(() => { load(); }, [statusFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleStatusChange(id: string, status: string) {
    await appointmentApi.updateBookingStatus(id, status);
    load();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2"><Calendar className="w-6 h-6 text-brand-600" /> Appointment Booking</h1>
      </div>

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Total Bookings', value: stats.total, icon: Calendar, color: 'text-blue-500' },
            { label: 'Confirmed', value: stats.confirmed, icon: CheckCircle, color: 'text-emerald-500' },
            { label: 'Completed', value: stats.completed, icon: Users, color: 'text-violet-500' },
            { label: 'No-Shows', value: stats.noShow, icon: XCircle, color: 'text-red-500' },
          ].map((c) => (
            <div key={c.label} className="rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-4">
              <div className="flex items-center gap-2 text-sm text-gray-500 mb-1"><c.icon className={`w-4 h-4 ${c.color}`} /> {c.label}</div>
              <p className="text-2xl font-bold">{c.value}</p>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-2 border-b border-gray-200 dark:border-gray-800">
        {(['bookings', 'services'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === t ? 'border-brand-600 text-brand-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            {t === 'bookings' ? 'Bookings' : 'Services & Slots'}
          </button>
        ))}
      </div>

      {tab === 'bookings' && (
        <>
          <div className="flex gap-2">
            {['all', 'pending', 'confirmed', 'completed', 'cancelled', 'no_show'].map((s) => (
              <button key={s} onClick={() => setStatusFilter(s)}
                className={`px-3 py-1 text-xs rounded-full border transition-colors ${statusFilter === s ? 'bg-brand-600 text-white border-brand-600' : 'border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'}`}>
                {s.replace('_', ' ').replace(/^\w/, c => c.toUpperCase())}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="animate-pulse space-y-3">{[...Array(5)].map((_, i) => <div key={i} className="h-12 rounded-lg bg-gray-200 dark:bg-gray-800" />)}</div>
          ) : bookings.length === 0 ? (
            <div className="text-center text-gray-500 py-12">No bookings yet.</div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-800">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-900">
                  <tr>{['Customer', 'Phone', 'Date', 'Time', 'Status', 'Reminder', 'Actions'].map((h) => (
                    <th key={h} className="px-4 py-3 text-left font-medium text-gray-500">{h}</th>
                  ))}</tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                  {bookings.map((b) => (
                    <tr key={b.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                      <td className="px-4 py-3 font-medium">{b.customer_name ?? '—'}</td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{b.customer_phone}</td>
                      <td className="px-4 py-3">{new Date(b.booking_date).toLocaleDateString()}</td>
                      <td className="px-4 py-3">{b.start_time}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusBadge(b.status)}`}>{b.status.replace('_', ' ')}</span>
                      </td>
                      <td className="px-4 py-3">{b.reminder_sent ? <CheckCircle className="w-4 h-4 text-emerald-500" /> : <Clock className="w-4 h-4 text-gray-400" />}</td>
                      <td className="px-4 py-3 flex gap-1">
                        {b.status === 'pending' && <button onClick={() => handleStatusChange(b.id, 'confirmed')} className="text-xs text-blue-600 hover:underline">Confirm</button>}
                        {b.status === 'confirmed' && <button onClick={() => handleStatusChange(b.id, 'completed')} className="text-xs text-emerald-600 hover:underline">Complete</button>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {tab === 'services' && (
        <div className="space-y-4">
          {services.length === 0 ? (
            <div className="text-center text-gray-500 py-12">No services configured. Create a bookable service to get started.</div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {services.map((s) => (
                <div key={s.id} className="rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold">{s.name}</h3>
                    <span className={`px-2 py-0.5 rounded-full text-xs ${s.is_active ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'}`}>
                      {s.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <div className="flex gap-4 text-sm text-gray-500">
                    <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {s.duration_min} min</span>
                    <span>{s.currency} {(s.price / 100).toFixed(2)}</span>
                    {s.location && <span>{s.location}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
