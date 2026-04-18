import { useState, memo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Shield, Users, Settings2, Activity, Server, UserPlus, Trash2, Edit3,
  CheckCircle2, XCircle, Crown, ChevronRight, RefreshCw, BarChart3,
  AlertTriangle, Send, PauseCircle, PlayCircle, Webhook, Plus,
} from 'lucide-react';
import { adminApi } from '../../../../packages/ui/src/services/api';
import { useAuthStore } from '../stores/authStore';
import { cn } from '../../../../packages/utils/src/frontend-utils';
import toast from 'react-hot-toast';

type Tab = 'overview' | 'users' | 'providers' | 'campaigns';

interface SystemOverview {
  users: { total: number };
  providers: { total: number; healthy: number };
  campaigns: { total: number; active: number };
  leads: { total: number };
}

interface UserRecord {
  id: string;
  email: string;
  full_name: string | null;
  role: string;
  is_active: boolean;
  last_login_at: string | null;
  created_at: string;
}

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

interface CampaignError {
  id: string;
  campaign_id: string;
  channel: string;
  recipient: string;
  provider: string | null;
  error_message: string;
  created_at: string;
}

const tabs: { key: Tab; label: string; icon: typeof Shield }[] = [
  { key: 'overview', label: 'Overview', icon: BarChart3 },
  { key: 'users', label: 'Users', icon: Users },
  { key: 'providers', label: 'Providers', icon: Server },
  { key: 'campaigns', label: 'Campaigns', icon: Activity },
];

function roleColor(role: string) {
  if (role === 'superadmin') return 'bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-300';
  if (role === 'admin') return 'bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300';
  return 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400';
}

function statusDot(status: string) {
  if (status === 'connected') return 'bg-emerald-500';
  if (status === 'failed') return 'bg-red-500';
  if (status === 'paused') return 'bg-yellow-500';
  return 'bg-gray-400';
}

export default memo(function AdminPanelPage() {
  const queryClient = useQueryClient();
  const currentUser = useAuthStore((s) => s.user);
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [editingUser, setEditingUser] = useState<string | null>(null);
  const [editRole, setEditRole] = useState('');
  const [showInvite, setShowInvite] = useState(false);
  const [inviteForm, setInviteForm] = useState({ email: '', fullName: '', role: 'member' as string });

  // ── Queries ──
  const { data: overviewData } = useQuery({
    queryKey: ['admin-overview'],
    queryFn: () => adminApi.getSystemOverview(),
    refetchInterval: 30_000,
    enabled: activeTab === 'overview',
  });

  const { data: usersData, isLoading: usersLoading } = useQuery({
    queryKey: ['admin-users'],
    queryFn: () => adminApi.listUsers(),
    enabled: activeTab === 'users',
  });

  const { data: providersData } = useQuery({
    queryKey: ['admin-providers-all'],
    queryFn: () => adminApi.listProviders(),
    refetchInterval: 30_000,
    enabled: activeTab === 'providers',
  });

  const { data: errorsData } = useQuery({
    queryKey: ['admin-campaign-errors'],
    queryFn: () => adminApi.getCampaignErrors({ limit: '50' }),
    refetchInterval: 30_000,
    enabled: activeTab === 'campaigns',
  });

  const overview: SystemOverview | null = overviewData?.overview ?? null;
  const users: UserRecord[] = usersData?.users ?? [];
  const providers: ProviderRecord[] = providersData?.providers ?? [];
  const campaignErrors: CampaignError[] = errorsData?.errors ?? [];

  // ── Mutations ──
  const updateUserMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) => adminApi.updateUser(id, data),
    onSuccess: () => {
      toast.success('User updated');
      setEditingUser(null);
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    },
    onError: (err: Error) => toast.error(err.message || 'Update failed'),
  });

  const deleteUserMutation = useMutation({
    mutationFn: (id: string) => adminApi.deleteUser(id),
    onSuccess: () => {
      toast.success('User deleted');
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    },
    onError: (err: Error) => toast.error(err.message || 'Delete failed'),
  });

  const inviteUserMutation = useMutation({
    mutationFn: (data: { email: string; fullName?: string; role?: string }) => adminApi.inviteUser(data),
    onSuccess: () => {
      toast.success('User invited');
      setShowInvite(false);
      setInviteForm({ email: '', fullName: '', role: 'member' });
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    },
    onError: (err: Error) => toast.error(err.message || 'Invite failed'),
  });

  const validateMutation = useMutation({
    mutationFn: (id: string) => adminApi.validateProvider(id),
    onSuccess: () => {
      toast.success('Validated');
      queryClient.invalidateQueries({ queryKey: ['admin-providers-all'] });
    },
  });

  const retryMutation = useMutation({
    mutationFn: (campaignId: string) => adminApi.retryCampaign(campaignId),
    onSuccess: (data) => {
      toast.success(`Requeued ${data.requeued || 0} messages`);
      queryClient.invalidateQueries({ queryKey: ['admin-campaign-errors'] });
    },
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-xl bg-gradient-to-br from-brand-600 to-purple-600">
          <Shield className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Admin Panel</h1>
          <p className="text-gray-500 dark:text-gray-400">
            Logged in as <span className="font-medium text-gray-700 dark:text-gray-200">{currentUser?.email}</span>
            <span className={cn('ml-2 px-2 py-0.5 rounded-full text-xs font-medium', roleColor(currentUser?.role ?? 'member'))}>{currentUser?.role}</span>
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200 dark:border-gray-800">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              'flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors',
              activeTab === tab.key
                ? 'border-brand-600 text-brand-600 dark:text-brand-400'
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
            )}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <AnimatePresence mode="wait">
        {activeTab === 'overview' && (
          <motion.div key="overview" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              {[
                { label: 'Total Users', value: overview?.users.total ?? 0, icon: Users, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-100 dark:bg-blue-500/10' },
                { label: 'Active Providers', value: `${overview?.providers.healthy ?? 0}/${overview?.providers.total ?? 0}`, icon: Server, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-100 dark:bg-emerald-500/10' },
                { label: 'Active Campaigns', value: overview?.campaigns.active ?? 0, icon: Activity, color: 'text-purple-600 dark:text-purple-400', bg: 'bg-purple-100 dark:bg-purple-500/10' },
                { label: 'Total Leads', value: overview?.leads.total ?? 0, icon: BarChart3, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-100 dark:bg-amber-500/10' },
              ].map((stat) => (
                <div key={stat.label} className="card">
                  <div className="flex items-center gap-3">
                    <div className={cn('p-2 rounded-lg', stat.bg)}>
                      <stat.icon className={cn('w-5 h-5', stat.color)} />
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{stat.label}</p>
                      <p className="text-xl font-bold">{stat.value}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Quick Links */}
            <div className="card">
              <h3 className="font-semibold mb-4">Quick Actions</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {[
                  { label: 'Manage Users', desc: 'Add, edit, or remove users', onClick: () => setActiveTab('users'), icon: Users },
                  { label: 'Configure Providers', desc: 'Set up WhatsApp, SMS, Email providers', onClick: () => setActiveTab('providers'), icon: Settings2 },
                  { label: 'Campaign Errors', desc: 'View and retry failed campaigns', onClick: () => setActiveTab('campaigns'), icon: AlertTriangle },
                ].map((action) => (
                  <button key={action.label} onClick={action.onClick}
                    className="flex items-center gap-3 p-4 rounded-xl border border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors text-left">
                    <action.icon className="w-5 h-5 text-brand-600" />
                    <div className="flex-1">
                      <p className="font-medium text-sm">{action.label}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{action.desc}</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-400" />
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'users' && (
          <motion.div key="users" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">User Management</h2>
              <button onClick={() => setShowInvite(true)}
                className="flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 text-sm">
                <UserPlus className="w-4 h-4" /> Invite User
              </button>
            </div>

            {/* Invite Modal */}
            {showInvite && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowInvite(false)}>
                <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 w-full max-w-md shadow-xl" onClick={e => e.stopPropagation()}>
                  <h3 className="text-lg font-bold mb-4">Invite New User</h3>
                  <div className="space-y-3">
                    <div>
                      <label className="text-sm text-gray-600 dark:text-gray-400">Email *</label>
                      <input type="email" value={inviteForm.email} onChange={e => setInviteForm({ ...inviteForm, email: e.target.value })}
                        className="input w-full mt-1" placeholder="user@example.com" />
                    </div>
                    <div>
                      <label className="text-sm text-gray-600 dark:text-gray-400">Full Name</label>
                      <input value={inviteForm.fullName} onChange={e => setInviteForm({ ...inviteForm, fullName: e.target.value })}
                        className="input w-full mt-1" placeholder="John Doe" />
                    </div>
                    <div>
                      <label className="text-sm text-gray-600 dark:text-gray-400">Role</label>
                      <select value={inviteForm.role} onChange={e => setInviteForm({ ...inviteForm, role: e.target.value })}
                        className="input w-full mt-1">
                        <option value="member">Member</option>
                        <option value="admin">Admin</option>
                      </select>
                    </div>
                  </div>
                  <div className="flex gap-2 mt-5">
                    <button onClick={() => setShowInvite(false)} className="flex-1 btn-secondary text-sm">Cancel</button>
                    <button onClick={() => inviteUserMutation.mutate({
                      email: inviteForm.email,
                      fullName: inviteForm.fullName || undefined,
                      role: inviteForm.role,
                    })} disabled={!inviteForm.email} className="flex-1 btn-primary text-sm">Invite</button>
                  </div>
                </div>
              </div>
            )}

            {/* Users Table */}
            <div className="card overflow-hidden p-0">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-800">
                      <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 p-4">User</th>
                      <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 p-4">Role</th>
                      <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 p-4">Status</th>
                      <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 p-4">Last Login</th>
                      <th className="text-right text-xs font-medium text-gray-500 dark:text-gray-400 p-4">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {usersLoading && (
                      <tr><td colSpan={5} className="text-center py-8 text-gray-500">Loading...</td></tr>
                    )}
                    {users.map((user) => (
                      <tr key={user.id} className="border-b border-gray-100 dark:border-gray-800/50 hover:bg-gray-50 dark:hover:bg-gray-800/30">
                        <td className="p-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-brand-100 dark:bg-brand-500/20 flex items-center justify-center">
                              <span className="text-xs font-bold text-brand-600 dark:text-brand-400">{(user.full_name || user.email).charAt(0).toUpperCase()}</span>
                            </div>
                            <div>
                              <p className="font-medium text-sm">{user.full_name || '—'}</p>
                              <p className="text-xs text-gray-500">{user.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="p-4">
                          {editingUser === user.id ? (
                            <select value={editRole} onChange={e => setEditRole(e.target.value)}
                              className="text-xs px-2 py-1 rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800">
                              <option value="member">member</option>
                              <option value="admin">admin</option>
                              <option value="superadmin">superadmin</option>
                            </select>
                          ) : (
                            <span className={cn('px-2 py-1 rounded-full text-xs font-medium', roleColor(user.role))}>{user.role}</span>
                          )}
                        </td>
                        <td className="p-4">
                          <span className={cn('flex items-center gap-1.5 text-xs', user.is_active ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400')}>
                            {user.is_active ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                            {user.is_active ? 'Active' : 'Disabled'}
                          </span>
                        </td>
                        <td className="p-4 text-xs text-gray-500">
                          {user.last_login_at ? new Date(user.last_login_at).toLocaleDateString() : 'Never'}
                        </td>
                        <td className="p-4">
                          <div className="flex items-center justify-end gap-1">
                            {editingUser === user.id ? (
                              <>
                                <button onClick={() => updateUserMutation.mutate({ id: user.id, data: { role: editRole } })}
                                  className="p-1.5 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded text-xs">Save</button>
                                <button onClick={() => setEditingUser(null)}
                                  className="p-1.5 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 rounded text-xs">Cancel</button>
                              </>
                            ) : (
                              <>
                                {user.id !== currentUser?.id && (
                                  <>
                                    <button onClick={() => { setEditingUser(user.id); setEditRole(user.role); }}
                                      className="p-1.5 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 rounded" title="Edit role">
                                      <Edit3 className="w-3.5 h-3.5" />
                                    </button>
                                    <button onClick={() => updateUserMutation.mutate({ id: user.id, data: { is_active: !user.is_active } })}
                                      className={cn('p-1.5 rounded', user.is_active ? 'text-yellow-600 hover:bg-yellow-50 dark:hover:bg-yellow-900/20' : 'text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20')}
                                      title={user.is_active ? 'Disable' : 'Enable'}>
                                      {user.is_active ? <PauseCircle className="w-3.5 h-3.5" /> : <PlayCircle className="w-3.5 h-3.5" />}
                                    </button>
                                    <button onClick={() => { if (confirm(`Delete ${user.email}?`)) deleteUserMutation.mutate(user.id); }}
                                      className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded" title="Delete">
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </>
                                )}
                                {user.id === currentUser?.id && (
                                  <span className="text-xs text-gray-400 italic">You</span>
                                )}
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'providers' && (
          <motion.div key="providers" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Provider Configuration</h2>
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
                    <a href="/admin" className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg text-xs bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700">
                      <Settings2 className="w-3 h-3" /> Edit Full
                    </a>
                  </div>
                </div>
              ))}
              {providers.length === 0 && (
                <div className="col-span-full text-center py-12 text-gray-500">
                  <Server className="w-10 h-10 mx-auto mb-3 opacity-30" />
                  <p>No providers configured yet</p>
                  <a href="/admin" className="text-brand-600 text-sm mt-2 inline-block hover:underline">Go to Channel Configuration →</a>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {activeTab === 'campaigns' && (
          <motion.div key="campaigns" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Campaign Error Recovery</h2>
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
                      <button onClick={() => retryMutation.mutate(err.campaign_id)}
                        className="flex-shrink-0 btn-primary text-xs px-3 py-1.5">
                        <RefreshCw className="w-3 h-3 mr-1 inline" /> Retry
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});
