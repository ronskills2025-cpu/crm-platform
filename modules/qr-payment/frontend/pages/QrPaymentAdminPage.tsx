import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  Settings2, Clock, CheckCircle, XCircle, IndianRupee, Eye,
  Image, FileText, Save, BarChart3, Filter,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { qrPaymentApi } from '../../../../packages/ui/src/services/api';

type Tab = 'payments' | 'config';

export default function QrPaymentAdminPage() {
  const [tab, setTab] = useState<Tab>('payments');
  const tabs: { key: Tab; label: string; icon: typeof BarChart3 }[] = [
    { key: 'payments', label: 'Payments', icon: BarChart3 },
    { key: 'config', label: 'Configuration', icon: Settings2 },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">QR Payment Admin</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">Manage QR payment configuration and verify payments</p>
      </div>

      <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-lg w-fit">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              tab === t.key ? 'bg-white dark:bg-gray-900 text-brand-600 shadow-sm' : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
            }`}>
            <t.icon className="w-4 h-4" /> {t.label}
          </button>
        ))}
      </div>

      {tab === 'payments' ? <PaymentsPanel /> : <ConfigPanel />}
    </div>
  );
}

// ── Stats + Payments Panel ────────────────────────────────────────────────────

function PaymentsPanel() {
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<any>(null);
  const [action, setAction] = useState<'approve' | 'reject' | null>(null);
  const [notes, setNotes] = useState('');

  const params: Record<string, string> = { page: String(page), limit: '20' };
  if (statusFilter) params.status = statusFilter;

  const { data: statsData } = useQuery({ queryKey: ['qr-payment-stats'], queryFn: () => qrPaymentApi.getStats() });
  const { data, isLoading } = useQuery({ queryKey: ['qr-payments', statusFilter, page], queryFn: () => qrPaymentApi.listPayments(params) });

  const approveMut = useMutation({
    mutationFn: ({ id, note }: { id: string; note?: string }) => qrPaymentApi.approvePayment(id, { notes: note }),
    onSuccess: () => { toast.success('Payment approved'); invalidate(); setSelected(null); setAction(null); },
    onError: (e: any) => toast.error(e?.response?.data?.error || 'Failed'),
  });

  const rejectMut = useMutation({
    mutationFn: ({ id, note }: { id: string; note: string }) => qrPaymentApi.rejectPayment(id, { notes: note }),
    onSuccess: () => { toast.success('Payment rejected'); invalidate(); setSelected(null); setAction(null); },
    onError: (e: any) => toast.error(e?.response?.data?.error || 'Failed'),
  });

  const invalidate = useCallback(() => {
    qc.invalidateQueries({ queryKey: ['qr-payments'] });
    qc.invalidateQueries({ queryKey: ['qr-payment-stats'] });
  }, [qc]);

  const stats = statsData?.stats;
  const payments = data?.payments || [];
  const total = data?.total || 0;
  const totalPages = Math.ceil(total / 20);

  const statCards = [
    { label: 'Pending', value: stats?.pending_count ?? '-', icon: Clock, color: 'text-yellow-600', bg: 'bg-yellow-50 dark:bg-yellow-900/20' },
    { label: 'Approved', value: stats?.approved_count ?? '-', icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-50 dark:bg-green-900/20' },
    { label: 'Rejected', value: stats?.rejected_count ?? '-', icon: XCircle, color: 'text-red-600', bg: 'bg-red-50 dark:bg-red-900/20' },
    { label: 'Approved Amt', value: stats ? `₹${Number(stats.approved_amount).toLocaleString()}` : '-', icon: IndianRupee, color: 'text-brand-600', bg: 'bg-brand-50 dark:bg-brand-900/20' },
  ];

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {statCards.map((s, i) => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
            className={`p-4 rounded-xl border border-gray-200 dark:border-gray-800 ${s.bg}`}>
            <div className="flex items-center gap-2 mb-2">
              <s.icon className={`w-4 h-4 ${s.color}`} />
              <span className="text-sm text-gray-600 dark:text-gray-400">{s.label}</span>
            </div>
            <span className="text-2xl font-bold text-gray-900 dark:text-gray-100">{s.value}</span>
          </motion.div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <Filter className="w-4 h-4 text-gray-500" />
        {['', 'pending', 'approved', 'rejected'].map(s => (
          <button key={s} onClick={() => { setStatusFilter(s); setPage(1); }}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              statusFilter === s ? 'bg-brand-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
            }`}>
            {s || 'All'}
          </button>
        ))}
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="space-y-2">{[...Array(5)].map((_, i) => <div key={i} className="h-16 rounded-lg bg-gray-200 dark:bg-gray-800 animate-pulse" />)}</div>
      ) : payments.length === 0 ? (
        <div className="text-center py-16 text-gray-500 dark:text-gray-400">
          <FileText className="w-10 h-10 mx-auto mb-2 opacity-40" />
          <p>No payments found</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-800">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-800/50">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Txn ID</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Name</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Phone</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Amount</th>
                <th className="text-center px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Status</th>
                <th className="text-center px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Date</th>
                <th className="text-center px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {payments.map((p: any) => {
                const sc = statusCfg[p.status] || statusCfg.pending;
                return (
                  <tr key={p.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <td className="px-4 py-3 font-mono text-xs">{p.transaction_id}</td>
                    <td className="px-4 py-3">{p.name}</td>
                    <td className="px-4 py-3 text-gray-500">{p.phone}</td>
                    <td className="px-4 py-3 text-right font-semibold">₹{Number(p.amount).toLocaleString()}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${sc.bg} ${sc.color}`}>
                        <sc.icon className="w-3 h-3" /> {sc.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center text-gray-500 text-xs">{new Date(p.created_at).toLocaleDateString()}</td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button onClick={() => { setSelected(p); setAction(null); setNotes(''); }}
                          className="p-1.5 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700" title="View">
                          <Eye className="w-4 h-4 text-gray-500" />
                        </button>
                        {p.status === 'pending' && (
                          <>
                            <button onClick={() => { setSelected(p); setAction('approve'); setNotes(''); }}
                              className="p-1.5 rounded-lg hover:bg-green-100 dark:hover:bg-green-900/30" title="Approve">
                              <CheckCircle className="w-4 h-4 text-green-600" />
                            </button>
                            <button onClick={() => { setSelected(p); setAction('reject'); setNotes(''); }}
                              className="p-1.5 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30" title="Reject">
                              <XCircle className="w-4 h-4 text-red-600" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-2">
          {Array.from({ length: totalPages }, (_, i) => i + 1).slice(Math.max(0, page - 3), page + 2).map(p => (
            <button key={p} onClick={() => setPage(p)}
              className={`px-3 py-1 rounded-lg text-sm ${p === page ? 'bg-brand-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'}`}>
              {p}
            </button>
          ))}
        </div>
      )}

      {/* Detail / Action Modal */}
      {selected && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setSelected(null)}>
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
            className="bg-white dark:bg-gray-900 rounded-2xl p-6 w-full max-w-lg space-y-4 max-h-[90vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">
              {action === 'approve' ? 'Approve Payment' : action === 'reject' ? 'Reject Payment' : 'Payment Details'}
            </h3>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><span className="text-gray-500">Txn ID:</span> <span className="font-mono font-semibold ml-1">{selected.transaction_id}</span></div>
              <div><span className="text-gray-500">Amount:</span> <span className="font-bold ml-1">₹{Number(selected.amount).toLocaleString()}</span></div>
              <div><span className="text-gray-500">Name:</span> <span className="ml-1">{selected.name}</span></div>
              <div><span className="text-gray-500">Phone:</span> <span className="ml-1">{selected.phone}</span></div>
              {selected.email && <div className="col-span-2"><span className="text-gray-500">Email:</span> <span className="ml-1">{selected.email}</span></div>}
              <div><span className="text-gray-500">Date:</span> <span className="ml-1">{new Date(selected.created_at).toLocaleString()}</span></div>
              <div>
                <span className="text-gray-500">Status:</span>
                <span className={`ml-1 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${(statusCfg[selected.status] || statusCfg.pending).bg} ${(statusCfg[selected.status] || statusCfg.pending).color}`}>
                  {(statusCfg[selected.status] || statusCfg.pending).label}
                </span>
              </div>
            </div>

            {/* Screenshot */}
            <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
              <Image className="w-4 h-4" /> Screenshot
            </div>
            <img
              src={qrPaymentApi.getScreenshotUrl(selected.id)}
              alt="Payment screenshot"
              className="w-full rounded-lg border border-gray-200 dark:border-gray-700 max-h-64 object-contain bg-gray-50 dark:bg-gray-800"
              onError={e => { (e.target as HTMLImageElement).src = ''; (e.target as HTMLImageElement).alt = 'Failed to load screenshot'; }}
            />

            {selected.admin_notes && (
              <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-800 text-sm">
                <span className="text-gray-500">Admin notes:</span> {selected.admin_notes}
              </div>
            )}

            {/* Action form */}
            {action && (
              <div className="space-y-3 pt-2 border-t border-gray-200 dark:border-gray-800">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Notes {action === 'reject' ? '*' : '(optional)'}
                  </label>
                  <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                    placeholder={action === 'reject' ? 'Reason for rejection (required)' : 'Optional notes'} />
                </div>
                <div className="flex gap-3">
                  <button onClick={() => setAction(null)}
                    className="flex-1 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800">
                    Cancel
                  </button>
                  {action === 'approve' ? (
                    <button onClick={() => approveMut.mutate({ id: selected.id, note: notes || undefined })}
                      disabled={approveMut.isPending}
                      className="flex-1 py-2 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 disabled:opacity-50">
                      {approveMut.isPending ? 'Approving...' : 'Approve'}
                    </button>
                  ) : (
                    <button onClick={() => { if (!notes.trim()) { toast.error('Rejection reason is required'); return; } rejectMut.mutate({ id: selected.id, note: notes }); }}
                      disabled={rejectMut.isPending}
                      className="flex-1 py-2 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 disabled:opacity-50">
                      {rejectMut.isPending ? 'Rejecting...' : 'Reject'}
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Close */}
            {!action && (
              <div className="flex gap-3">
                <button onClick={() => setSelected(null)}
                  className="flex-1 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800">
                  Close
                </button>
                {selected.status === 'pending' && (
                  <>
                    <button onClick={() => { setAction('approve'); setNotes(''); }}
                      className="flex-1 py-2 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700">
                      Approve
                    </button>
                    <button onClick={() => { setAction('reject'); setNotes(''); }}
                      className="flex-1 py-2 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700">
                      Reject
                    </button>
                  </>
                )}
              </div>
            )}
          </motion.div>
        </div>
      )}
    </div>
  );
}

const statusCfg: Record<string, { icon: typeof Clock; color: string; bg: string; label: string }> = {
  pending:  { icon: Clock,       color: 'text-yellow-600', bg: 'bg-yellow-100 dark:bg-yellow-900/30', label: 'Pending' },
  approved: { icon: CheckCircle, color: 'text-green-600',  bg: 'bg-green-100 dark:bg-green-900/30',  label: 'Approved' },
  rejected: { icon: XCircle,     color: 'text-red-600',    bg: 'bg-red-100 dark:bg-red-900/30',      label: 'Rejected' },
};

// ── Config Panel ──────────────────────────────────────────────────────────────

function ConfigPanel() {
  const qc = useQueryClient();
  const { data: cfgData, isLoading } = useQuery({ queryKey: ['qr-payment-config'], queryFn: () => qrPaymentApi.getConfig() });
  const [form, setForm] = useState<any>(null);

  // Sync initial data
  const config = cfgData?.config;
  if (config && !form) {
    setForm({
      qr_code_url: config.qr_code_url || '',
      upi_id: config.upi_id || '',
      bank_name: config.bank_details?.bank_name || '',
      account_name: config.bank_details?.account_name || '',
      account_number: config.bank_details?.account_number || '',
      ifsc_code: config.bank_details?.ifsc_code || '',
      branch: config.bank_details?.branch || '',
      whatsapp_number: config.whatsapp_number || '',
      instructions: config.instructions || '',
      is_enabled: config.is_enabled ?? false,
    });
  }

  const saveMut = useMutation({
    mutationFn: (data: any) => qrPaymentApi.updateConfig(data),
    onSuccess: () => { toast.success('Config saved!'); qc.invalidateQueries({ queryKey: ['qr-payment-config'] }); },
    onError: () => toast.error('Failed to save config'),
  });

  const handleSave = useCallback(() => {
    if (!form) return;
    saveMut.mutate({
      qr_code_url: form.qr_code_url || null,
      upi_id: form.upi_id || null,
      bank_details: {
        bank_name: form.bank_name || undefined,
        account_name: form.account_name || undefined,
        account_number: form.account_number || undefined,
        ifsc_code: form.ifsc_code || undefined,
        branch: form.branch || undefined,
      },
      whatsapp_number: form.whatsapp_number || null,
      instructions: form.instructions || null,
      is_enabled: form.is_enabled,
    });
  }, [form, saveMut]);

  if (isLoading || !form) {
    return <div className="h-64 rounded-xl bg-gray-200 dark:bg-gray-800 animate-pulse" />;
  }

  const input = (label: string, key: string, placeholder: string, type = 'text') => (
    <div>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{label}</label>
      <input type={type} value={form[key]} onChange={e => setForm((p: any) => ({ ...p, [key]: e.target.value }))}
        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-brand-500"
        placeholder={placeholder} />
    </div>
  );

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      className="p-6 rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 space-y-5 max-w-2xl">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-gray-900 dark:text-gray-100">Payment Configuration</h2>
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={form.is_enabled} onChange={e => setForm((p: any) => ({ ...p, is_enabled: e.target.checked }))}
            className="rounded border-gray-300 text-brand-600 focus:ring-brand-500" />
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Enable QR Payments</span>
        </label>
      </div>

      {input('QR Code Image URL', 'qr_code_url', 'https://example.com/qr.png', 'url')}
      {input('UPI ID', 'upi_id', 'name@upi')}
      {input('WhatsApp Number', 'whatsapp_number', '+919876543210')}

      <div className="border-t border-gray-200 dark:border-gray-800 pt-4">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Bank Details</h3>
        <div className="grid grid-cols-2 gap-3">
          {input('Bank Name', 'bank_name', 'State Bank of India')}
          {input('Account Holder', 'account_name', 'John Doe')}
          {input('Account Number', 'account_number', '1234567890')}
          {input('IFSC Code', 'ifsc_code', 'SBIN0001234')}
          {input('Branch', 'branch', 'Main Branch')}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Payment Instructions</label>
        <textarea value={form.instructions} onChange={e => setForm((p: any) => ({ ...p, instructions: e.target.value }))} rows={3}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-brand-500"
          placeholder="Instructions shown to users on the checkout page..." />
      </div>

      <button onClick={handleSave} disabled={saveMut.isPending}
        className="flex items-center gap-2 px-6 py-2.5 bg-brand-600 text-white rounded-lg font-semibold hover:bg-brand-700 disabled:opacity-50">
        <Save className="w-4 h-4" /> {saveMut.isPending ? 'Saving...' : 'Save Configuration'}
      </button>
    </motion.div>
  );
}
