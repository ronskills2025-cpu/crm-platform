import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, Users, Phone, MoreHorizontal, X } from 'lucide-react';
import { tenantApi } from '../../../../packages/ui/src/services/api';

interface Tenant {
  id: string;
  name: string;
  slug: string;
  plan: string;
  status: string;
  contactEmail: string | null;
  createdAt: string;
}

interface TenantStats {
  numbers: number;
  subscription: { status: string; plan: string } | null;
  cartRecovery: { total: number; recovered: number };
  conversions: { count: number; revenue: number };
}

const PLANS = ['trial', 'starter', 'pro', 'enterprise'];

function planBadge(plan: string) {
  const colours: Record<string, string> = {
    trial: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
    starter: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400',
    pro: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-400',
    enterprise: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400',
  };
  return colours[plan] ?? colours.trial;
}

function statusBadge(status: string) {
  return status === 'active'
    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400'
    : 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400';
}

// ─── Tenant form modal ───────────────────────────────────────────────────────
interface TenantFormProps {
  initial?: Partial<Tenant>;
  onSave: (data: Record<string, unknown>) => Promise<void>;
  onCancel: () => void;
}
function TenantForm({ initial, onSave, onCancel }: TenantFormProps) {
  const [name, setName] = useState(initial?.name ?? '');
  const [slug, setSlug] = useState(initial?.slug ?? '');
  const [plan, setPlan] = useState(initial?.plan ?? 'trial');
  const [contactEmail, setContactEmail] = useState(initial?.contactEmail ?? '');
  const [status, setStatus] = useState(initial?.status ?? 'active');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function submit() {
    setSaving(true);
    setError('');
    try {
      await onSave({ name, slug, plan, contactEmail: contactEmail || null, status });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            {initial?.id ? 'Edit Client' : 'New Client'}
          </h2>
          <button onClick={onCancel} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-3 py-2 text-sm text-red-700 dark:text-red-400">
            {error}
          </div>
        )}

        {[
          { label: 'Company name', value: name, setter: setName, placeholder: 'Acme Corp', type: 'text' },
          { label: 'Slug', value: slug, setter: setSlug, placeholder: 'acme-corp', type: 'text' },
          { label: 'Contact email', value: contactEmail, setter: setContactEmail, placeholder: 'admin@acme.com', type: 'email' },
        ].map(({ label, value, setter, placeholder, type }) => (
          <div key={label} className="space-y-1">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">{label}</label>
            <input
              type={type}
              value={value}
              onChange={(e) => setter(e.target.value)}
              placeholder={placeholder}
              className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
        ))}

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Plan</label>
            <select
              value={plan}
              onChange={(e) => setPlan(e.target.value)}
              className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              {PLANS.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              <option value="active">Active</option>
              <option value="suspended">Suspended</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={saving || !name || !slug}
            className="px-4 py-2 text-sm font-semibold bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white rounded-lg transition-colors"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Stats panel ─────────────────────────────────────────────────────────────
function StatsPanel({ tenantId, onClose }: { tenantId: string; onClose: () => void }) {
  const [stats, setStats] = useState<TenantStats | null>(null);

  useEffect(() => {
    tenantApi.getStats(tenantId).then((d: { stats: TenantStats }) => setStats(d.stats));
  }, [tenantId]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Client Stats</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
            <X className="w-5 h-5" />
          </button>
        </div>
        {!stats ? (
          <p className="text-sm text-gray-400 dark:text-gray-500">Loading…</p>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Numbers', value: stats.numbers },
              { label: 'Plan', value: stats.subscription?.plan ?? '—' },
              { label: 'Abandoned Carts', value: stats.cartRecovery.total },
              { label: 'Recovered', value: stats.cartRecovery.recovered },
              { label: 'Conversions', value: stats.conversions.count },
              { label: 'Revenue', value: `$${(stats.conversions.revenue / 100).toFixed(2)}` },
            ].map(({ label, value }) => (
              <div key={label} className="rounded-xl bg-gray-50 dark:bg-gray-800 p-3">
                <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
                <p className="text-lg font-bold text-gray-900 dark:text-gray-100 mt-0.5">{value}</p>
              </div>
            ))}
          </div>
        )}
        <button
          onClick={onClose}
          className="w-full rounded-lg py-2 text-sm bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
        >
          Close
        </button>
      </div>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────
export default function ClientsPage() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Tenant | null>(null);
  const [statsFor, setStatsFor] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const d = await tenantApi.list();
      setTenants(d.tenants ?? []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function handleCreate(data: Record<string, unknown>) {
    await tenantApi.create(data);
    setFormOpen(false);
    load();
  }

  async function handleUpdate(data: Record<string, unknown>) {
    if (!editing) return;
    await tenantApi.update(editing.id, data);
    setEditing(null);
    load();
  }

  async function handleDelete(id: string) {
    if (!window.confirm('Delete this client? This cannot be undone.')) return;
    await tenantApi.delete(id);
    load();
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Clients</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Manage agency clients and their plans</p>
        </div>
        <button
          onClick={() => setFormOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Client
        </button>
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-sm text-gray-400">Loading…</div>
        ) : tenants.length === 0 ? (
          <div className="p-8 text-center space-y-2">
            <Users className="w-8 h-8 text-gray-300 dark:text-gray-600 mx-auto" />
            <p className="text-sm text-gray-400">No clients yet. Create one to get started.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-800">
                {['Client', 'Plan', 'Status', 'Numbers', 'Email', 'Created', ''].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {tenants.map((t) => (
                <tr key={t.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900 dark:text-gray-100">{t.name}</div>
                    <div className="text-xs text-gray-400 dark:text-gray-500">{t.slug}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium capitalize ${planBadge(t.plan)}`}>
                      {t.plan}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium capitalize ${statusBadge(t.status)}`}>
                      {t.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => setStatsFor(t.id)}
                      className="inline-flex items-center gap-1 text-gray-600 dark:text-gray-400 hover:text-brand-600 dark:hover:text-brand-400"
                    >
                      <Phone className="w-3.5 h-3.5" />
                      View
                    </button>
                  </td>
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{t.contactEmail ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400">
                    {new Date(t.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 relative">
                    <button
                      onClick={() => setMenuOpen(menuOpen === t.id ? null : t.id)}
                      className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
                    >
                      <MoreHorizontal className="w-4 h-4 text-gray-400" />
                    </button>
                    {menuOpen === t.id && (
                      <div className="absolute right-4 top-8 z-10 w-32 rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-lg overflow-hidden">
                        <button
                          onClick={() => { setEditing(t); setMenuOpen(null); }}
                          className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300"
                        >
                          <Pencil className="w-3.5 h-3.5" /> Edit
                        </button>
                        <button
                          onClick={() => { setStatsFor(t.id); setMenuOpen(null); }}
                          className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300"
                        >
                          <Users className="w-3.5 h-3.5" /> Stats
                        </button>
                        <button
                          onClick={() => { handleDelete(t.id); setMenuOpen(null); }}
                          className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400"
                        >
                          <Trash2 className="w-3.5 h-3.5" /> Delete
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modals */}
      {formOpen && <TenantForm onSave={handleCreate} onCancel={() => setFormOpen(false)} />}
      {editing && <TenantForm initial={editing} onSave={handleUpdate} onCancel={() => setEditing(null)} />}
      {statsFor && <StatsPanel tenantId={statsFor} onClose={() => setStatsFor(null)} />}
    </div>
  );
}
