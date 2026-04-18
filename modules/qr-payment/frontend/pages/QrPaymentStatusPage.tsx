import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Clock, CheckCircle, XCircle, Receipt, IndianRupee } from 'lucide-react';
import { qrPaymentApi } from '../../../../packages/ui/src/services/api';

const statusConfig: Record<string, { icon: typeof Clock; color: string; bg: string; label: string }> = {
  pending:  { icon: Clock,       color: 'text-yellow-600', bg: 'bg-yellow-100 dark:bg-yellow-900/30', label: 'Pending' },
  approved: { icon: CheckCircle, color: 'text-green-600',  bg: 'bg-green-100 dark:bg-green-900/30',  label: 'Approved' },
  rejected: { icon: XCircle,     color: 'text-red-600',    bg: 'bg-red-100 dark:bg-red-900/30',      label: 'Rejected' },
};

export default function QrPaymentStatusPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['qr-my-payments'],
    queryFn: () => qrPaymentApi.myPayments(),
  });

  const payments = data?.payments || [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">My Payments</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">Track the status of your submitted payments</p>
      </div>

      {isLoading ? (
        <div className="space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="h-24 rounded-xl bg-gray-200 dark:bg-gray-800 animate-pulse" />)}</div>
      ) : payments.length === 0 ? (
        <div className="text-center py-16 text-gray-500 dark:text-gray-400">
          <Receipt className="w-12 h-12 mx-auto mb-3 opacity-40" />
          <p className="font-medium">No payments yet</p>
          <p className="text-sm mt-1">Submit a payment to see it here</p>
        </div>
      ) : (
        <div className="space-y-3">
          {payments.map((p: any, idx: number) => {
            const sc = statusConfig[p.status] || statusConfig.pending;
            const Icon = sc.icon;
            return (
              <motion.div key={p.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.05 }}
                className="p-4 rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 flex items-center gap-4">
                <div className={`p-2 rounded-lg ${sc.bg}`}>
                  <Icon className={`w-5 h-5 ${sc.color}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-gray-900 dark:text-gray-100">Txn: {p.transaction_id}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${sc.bg} ${sc.color}`}>{sc.label}</span>
                  </div>
                  <div className="flex items-center gap-4 mt-1 text-sm text-gray-500 dark:text-gray-400">
                    <span>{p.name}</span>
                    <span>{p.phone}</span>
                    <span>{new Date(p.created_at).toLocaleDateString()}</span>
                  </div>
                  {p.admin_notes && p.status === 'rejected' && (
                    <p className="text-sm text-red-600 dark:text-red-400 mt-1">Reason: {p.admin_notes}</p>
                  )}
                </div>
                <div className="text-right">
                  <div className="flex items-center gap-1 text-lg font-bold text-gray-900 dark:text-gray-100">
                    <IndianRupee className="w-4 h-4" />{Number(p.amount).toLocaleString()}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
