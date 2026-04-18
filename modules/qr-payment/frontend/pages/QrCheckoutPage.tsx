import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { QrCode, Upload, Send, CheckCircle, AlertCircle, Copy, ExternalLink } from 'lucide-react';
import toast from 'react-hot-toast';
import { qrPaymentApi } from '../../../../packages/ui/src/services/api';

export default function QrCheckoutPage() {
  const qc = useQueryClient();
  const [form, setForm] = useState({ transaction_id: '', name: '', phone: '', email: '', amount: '' });
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const { data: cfgData } = useQuery({ queryKey: ['qr-payment-config'], queryFn: () => qrPaymentApi.getConfig() });
  const config = cfgData?.config;

  const submitMut = useMutation({
    mutationFn: (fd: FormData) => qrPaymentApi.submitPayment(fd),
    onSuccess: () => { setSubmitted(true); toast.success('Payment submitted for review!'); qc.invalidateQueries({ queryKey: ['qr-my-payments'] }); },
    onError: (e: any) => toast.error(e?.response?.data?.error || 'Failed to submit payment'),
  });

  const handleFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 5 * 1024 * 1024) { toast.error('File must be under 5 MB'); return; }
    setFile(f);
    const reader = new FileReader();
    reader.onload = () => setPreview(reader.result as string);
    reader.readAsDataURL(f);
  }, []);

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (!file) { toast.error('Please upload a screenshot'); return; }
    if (!form.transaction_id || !form.name || !form.phone || !form.amount) { toast.error('Fill all required fields'); return; }
    const fd = new FormData();
    fd.append('screenshot', file);
    fd.append('transaction_id', form.transaction_id);
    fd.append('name', form.name);
    fd.append('phone', form.phone);
    if (form.email) fd.append('email', form.email);
    fd.append('amount', form.amount);
    submitMut.mutate(fd);
  }, [file, form, submitMut]);

  const copyText = useCallback((text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied!');
  }, []);

  if (submitted) {
    return (
      <div className="max-w-lg mx-auto mt-16 text-center space-y-4">
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="mx-auto w-20 h-20 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
          <CheckCircle className="w-10 h-10 text-green-600" />
        </motion.div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Payment Submitted!</h2>
        <p className="text-gray-600 dark:text-gray-400">Your payment is under review. You'll be notified once it's verified.</p>
        <button onClick={() => { setSubmitted(false); setFile(null); setPreview(null); setForm({ transaction_id: '', name: '', phone: '', email: '', amount: '' }); }}
          className="px-6 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700">
          Submit Another
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Pay via QR / UPI</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">Scan the QR code, make payment, and submit proof</p>
      </div>

      {!config?.is_enabled ? (
        <div className="p-6 rounded-xl bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-yellow-600" />
          <span className="text-yellow-800 dark:text-yellow-200">QR Payment is not enabled yet. Please configure it in admin settings.</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left: QR + Payment Info */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            className="p-6 rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 space-y-5">
            <h2 className="font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
              <QrCode className="w-5 h-5 text-brand-600" /> Payment Details
            </h2>

            {/* QR Code */}
            {config.qr_code_url && (
              <div className="flex flex-col items-center gap-2">
                <img src={config.qr_code_url} alt="QR Code" className="w-56 h-56 rounded-lg border border-gray-200 dark:border-gray-700 object-contain bg-white" />
                <span className="text-xs text-gray-500">Scan this QR code to pay</span>
              </div>
            )}

            {/* UPI ID */}
            {config.upi_id && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-gray-50 dark:bg-gray-800">
                <span className="text-sm text-gray-600 dark:text-gray-400">UPI ID:</span>
                <span className="font-mono font-semibold text-gray-900 dark:text-gray-100">{config.upi_id}</span>
                <button onClick={() => copyText(config.upi_id)} className="ml-auto p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded">
                  <Copy className="w-4 h-4 text-gray-500" />
                </button>
              </div>
            )}

            {/* Bank Details */}
            {config.bank_details && Object.keys(config.bank_details).length > 0 && (
              <div className="space-y-2">
                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">Bank Transfer</h3>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  {config.bank_details.bank_name && <><span className="text-gray-500">Bank:</span><span className="text-gray-900 dark:text-gray-100">{config.bank_details.bank_name}</span></>}
                  {config.bank_details.account_name && <><span className="text-gray-500">Name:</span><span className="text-gray-900 dark:text-gray-100">{config.bank_details.account_name}</span></>}
                  {config.bank_details.account_number && <><span className="text-gray-500">A/C No:</span><span className="font-mono text-gray-900 dark:text-gray-100">{config.bank_details.account_number}</span></>}
                  {config.bank_details.ifsc_code && <><span className="text-gray-500">IFSC:</span><span className="font-mono text-gray-900 dark:text-gray-100">{config.bank_details.ifsc_code}</span></>}
                  {config.bank_details.branch && <><span className="text-gray-500">Branch:</span><span className="text-gray-900 dark:text-gray-100">{config.bank_details.branch}</span></>}
                </div>
              </div>
            )}

            {/* WhatsApp */}
            {config.whatsapp_number && (
              <a href={`https://wa.me/${config.whatsapp_number.replace(/[^0-9]/g, '')}?text=Hi, I need help with payment`}
                target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-2 p-3 rounded-lg bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 hover:bg-green-100 dark:hover:bg-green-900/30 transition-colors">
                <ExternalLink className="w-4 h-4" /> Need help? Chat on WhatsApp
              </a>
            )}

            {/* Instructions */}
            {config.instructions && (
              <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-sm text-blue-800 dark:text-blue-200">
                {config.instructions}
              </div>
            )}
          </motion.div>

          {/* Right: Submission Form */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
            className="p-6 rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800">
            <h2 className="font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2 mb-4">
              <Send className="w-5 h-5 text-brand-600" /> Submit Payment Proof
            </h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Transaction / Reference ID *</label>
                <input value={form.transaction_id} onChange={e => setForm(p => ({ ...p, transaction_id: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-brand-500"
                  placeholder="e.g. UPI123456789" required />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Name *</label>
                  <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-brand-500"
                    placeholder="Your name" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Phone *</label>
                  <input value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-brand-500"
                    placeholder="+91..." required />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email</label>
                  <input value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} type="email"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-brand-500"
                    placeholder="email@example.com" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Amount (₹) *</label>
                  <input value={form.amount} onChange={e => setForm(p => ({ ...p, amount: e.target.value }))} type="number" step="0.01" min="1"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-brand-500"
                    placeholder="0.00" required />
                </div>
              </div>

              {/* Screenshot Upload */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Payment Screenshot *</label>
                <div className="relative border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg p-4 text-center hover:border-brand-500 transition-colors cursor-pointer"
                  onClick={() => document.getElementById('screenshot-input')?.click()}>
                  {preview ? (
                    <img src={preview} alt="Preview" className="mx-auto max-h-40 rounded-lg object-contain" />
                  ) : (
                    <div className="space-y-2 py-4">
                      <Upload className="w-8 h-8 mx-auto text-gray-400" />
                      <p className="text-sm text-gray-500">Click to upload screenshot</p>
                      <p className="text-xs text-gray-400">JPEG, PNG, WebP, GIF — max 5 MB</p>
                    </div>
                  )}
                  <input id="screenshot-input" type="file" accept="image/jpeg,image/png,image/webp,image/gif"
                    onChange={handleFile} className="hidden" />
                </div>
              </div>

              <button type="submit" disabled={submitMut.isPending}
                className="w-full py-3 bg-brand-600 text-white rounded-lg font-semibold hover:bg-brand-700 disabled:opacity-50 flex items-center justify-center gap-2">
                {submitMut.isPending ? (
                  <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Submitting...</>
                ) : (
                  <><Send className="w-4 h-4" /> Submit Payment</>
                )}
              </button>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
}
