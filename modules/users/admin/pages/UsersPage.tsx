import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  UserPlus, Trash2, Edit3, CheckCircle2, XCircle,
  PauseCircle, PlayCircle,
} from 'lucide-react';
import { adminApi } from '../services/admin.api';
import { useAuthStore } from '../stores/authStore';
import { cn } from '../lib/utils';
import toast from 'react-hot-toast';

interface UserRecord {
  id: string;
  email: string;
  full_name: string | null;
  role: string;
  is_active: boolean;
  last_login_at: string | null;
  created_at: string;
}

function roleColor(role: string) {
  if (role === 'superadmin') return 'bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-300';
  if (role === 'admin') return 'bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300';
  return 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400';
}

export default function UsersPage() {
  const queryClient = useQueryClient();
  const currentUser = useAuthStore((s) => s.user);
  const [editingUser, setEditingUser] = useState<string | null>(null);
  const [editRole, setEditRole] = useState('');
  const [showInvite, setShowInvite] = useState(false);
  const [inviteForm, setInviteForm] = useState({ email: '', fullName: '', role: 'member' as string });

  const { data: usersData, isLoading } = useQuery({
    queryKey: ['admin-users'],
    queryFn: () => adminApi.listUsers(),
  });

  const users: UserRecord[] = usersData?.users ?? [];

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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">User Management</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">{users.length} users total</p>
        </div>
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
                <label className="label">Email *</label>
                <input type="email" value={inviteForm.email} onChange={e => setInviteForm({ ...inviteForm, email: e.target.value })}
                  className="input w-full" placeholder="user@example.com" />
              </div>
              <div>
                <label className="label">Full Name</label>
                <input value={inviteForm.fullName} onChange={e => setInviteForm({ ...inviteForm, fullName: e.target.value })}
                  className="input w-full" placeholder="John Doe" />
              </div>
              <div>
                <label className="label">Role</label>
                <select value={inviteForm.role} onChange={e => setInviteForm({ ...inviteForm, role: e.target.value })}
                  className="input w-full">
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
              {isLoading && (
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
    </div>
  );
}
