import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { CreditCard, Plus, Users, Crown, Clock, CheckCircle, XCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { waSaasApi } from '../../../../packages/ui/src/services/api';

type Tab = 'plans' | 'subscriptions';

const statusColors: Record<string, string> = {
  active: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  paused: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  cancelled: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  expired: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400',
};

export default function SubscriptionBotPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>('plans');
  const [showCreate, setShowCreate] = useState(false);
  const [planForm, setPlanForm] = useState({ name: '', description: '', price: '', duration_days: '30', features: '' });

  const { data: plansData, isLoading: plansLoading } = useQuery({ queryKey: ['wa-saas-sub-plans'], queryFn: () => waSaasApi.subscriptions.listPlans() });
  const { data: subsData, isLoading: subsLoading } = useQuery({ queryKey: ['wa-saas-subscriptions'], queryFn: () => waSaasApi.subscriptions.list() });

  const createPlanMut = useMutation({
    mutationFn: (d: Record<string, unknown>) => waSaasApi.subscriptions.createPlan(d),
    onSuccess: () => { toast.success('Plan created'); qc.invalidateQueries({ queryKey: ['wa-saas-sub-plans'] }); setShowCreate(false); resetForm(); },
    onError: () => toast.error('Failed to create plan'),
  });

  const resetForm = useCallback(() => setPlanForm({ name: '', description: '', price: '', duration_days: '30', features: '' }), []);

  const plans = plansData?.plans || [];
  const subscriptions = subsData?.subscriptions || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2"><Crown className="w-6 h-6 text-amber-500" /> Subscription Bot</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Manage subscription plans and subscribers</p>
        </div>
        {tab === 'plans' && (
          <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700">
            <Plus className="w-4 h-4" /> New Plan
          </button>
        )}
      </div>

      <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-lg w-fit">
        {([['plans', 'Plans', CreditCard], ['subscriptions', 'Subscriptions', Users]] as [Tab, string, any][]).map(([key, label, Icon]) => (
          <button key={key} onClick={() => setTab(key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              tab === key ? 'bg-white dark:bg-gray-900 text-brand-600 shadow-sm' : 'text-gray-600 dark:text-gray-400'
            }`}>
            <Icon className="w-4 h-4" /> {label}
          </button>
        ))}
      </div>

      {tab === 'plans' ? (
        plansLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">{[...Array(3)].map((_, i) => <div key={i} className="h-40 rounded-xl bg-gray-200 dark:bg-gray-800 animate-pulse" />)}</div>
        ) : plans.length === 0 ? (
          <div className="text-center py-16 text-gray-500"><CreditCard className="w-12 h-12 mx-auto mb-3 opacity-40" /><p>No plans created yet</p></div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {plans.map((p: any, idx: number) => (
              <motion.div key={p.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.05 }}
                className="p-5 rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800">
                <h3 className="font-bold text-lg text-gray-900 dark:text-gray-100">{p.name}</h3>
                <p className="text-sm text-gray-500 mt-1">{p.description || 'No description'}</p>
                <div className="mt-3 text-2xl font-bold text-brand-600">₹{Number(p.price).toLocaleString()}<span className="text-sm font-normal text-gray-500">/{p.duration_days} days</span></div>
                {p.features && (
                  <ul className="mt-3 space-y-1 text-sm text-gray-600 dark:text-gray-400">
                    {(Array.isArray(p.features) ? p.features : []).map((f: string, fi: number) => (
                      <li key={fi} className="flex items-center gap-1"><CheckCircle className="w-3 h-3 text-green-500" /> {f}</li>
                    ))}
                  </ul>
                )}
              </motion.div>
            ))}
          </div>
        )
      ) : (
        subsLoading ? (
          <div className="space-y-3">{[...Array(4)].map((_, i) => <div key={i} className="h-16 rounded-xl bg-gray-200 dark:bg-gray-800 animate-pulse" />)}</div>
        ) : subscriptions.length === 0 ? (
          <div className="text-center py-16 text-gray-500"><Users className="w-12 h-12 mx-auto mb-3 opacity-40" /><p>No subscriptions yet</p></div>
        ) : (
          <div className="space-y-3">
            {subscriptions.map((s: any, idx: number) => (
              <motion.div key={s.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.03 }}
                className="p-4 rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 flex items-center gap-4">
                <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/30"><Crown className="w-5 h-5 text-amber-600" /></div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-gray-900 dark:text-gray-100">{s.customer_name || s.phone}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColors[s.status] || ''}`}>{s.status}</span>
                  </div>
                  <div className="text-sm text-gray-500 mt-0.5">{s.plan_name || 'Unknown plan'} · {s.phone}</div>
                </div>
                <span className="text-sm text-gray-500">{s.expires_at ? new Date(s.expires_at).toLocaleDateString() : '-'}</span>
              </motion.div>
            ))}
          </div>
        )
      )}

      {showCreate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowCreate(false)}>
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} onClick={e => e.stopPropagation()}
            className="bg-white dark:bg-gray-900 rounded-2xl p-6 w-full max-w-md space-y-4">
            <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">New Subscription Plan</h3>
            {([['Name', 'name'], ['Description', 'description'], ['Price (₹)', 'price'], ['Duration (days)', 'duration_days'], ['Features (comma-separated)', 'features']] as const).map(([label, key]) => (
              <div key={key}>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{label}</label>
                <input value={(planForm as any)[key]} onChange={e => setPlanForm(p => ({ ...p, [key]: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100" />
              </div>
            ))}
            <div className="flex gap-3">
              <button onClick={() => setShowCreate(false)} className="flex-1 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-600 dark:text-gray-400">Cancel</button>
              <button onClick={() => createPlanMut.mutate({ ...planForm, price: Number(planForm.price) || 0, duration_days: Number(planForm.duration_days) || 30, features: planForm.features.split(',').map(s => s.trim()).filter(Boolean) })}
                disabled={createPlanMut.isPending}
                className="flex-1 py-2 bg-brand-600 text-white rounded-lg font-semibold hover:bg-brand-700 disabled:opacity-50">
                {createPlanMut.isPending ? 'Creating...' : 'Create Plan'}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
