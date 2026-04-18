import { useEffect, useState } from 'react';
import { BarChart3, Zap, Package, Users, Link, Radio, CreditCard, Bot, MessageSquare, ShoppingBag, Send } from 'lucide-react';
import { waSaasApi } from '../../../../packages/ui/src/services/api';

interface OverviewStats {
  drip: { total_campaigns: number; active_campaigns: number };
  ai_bot: { total_configs: number; total_conversations: number };
  order_tracking: { total_orders: number; pending_orders: number };
  subscription: { total_plans: number; active_subscriptions: number };
  flash_sale: { total_sales: number; active_sales: number };
  team_inbox: { total_agents: number; open_conversations: number };
  link_tracking: { total_links: number; total_clicks: number };
  reengagement: { total_campaigns: number; total_contacts: number };
  broadcast_optimizer: { total_configs: number; total_batches: number };
  business_card: { total_cards: number; total_leads: number };
}

export default function WaSaasDashboardPage() {
  const [stats, setStats] = useState<OverviewStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    waSaasApi.getDashboard().then((d: { stats: OverviewStats }) => setStats(d.stats)).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600" /></div>;

  const cards = stats ? [
    { label: 'Drip Campaigns', value: stats.drip.total_campaigns, sub: `${stats.drip.active_campaigns} active`, icon: Send, color: 'text-emerald-500' },
    { label: 'AI Bot Chats', value: stats.ai_bot.total_conversations, sub: `${stats.ai_bot.total_configs} configs`, icon: Bot, color: 'text-purple-500' },
    { label: 'Orders', value: stats.order_tracking.total_orders, sub: `${stats.order_tracking.pending_orders} pending`, icon: Package, color: 'text-blue-500' },
    { label: 'Subscriptions', value: stats.subscription.active_subscriptions, sub: `${stats.subscription.total_plans} plans`, icon: CreditCard, color: 'text-amber-500' },
    { label: 'Flash Sales', value: stats.flash_sale.total_sales, sub: `${stats.flash_sale.active_sales} active`, icon: Zap, color: 'text-red-500' },
    { label: 'Team Inbox', value: stats.team_inbox.open_conversations, sub: `${stats.team_inbox.total_agents} agents`, icon: MessageSquare, color: 'text-cyan-500' },
    { label: 'Tracked Links', value: stats.link_tracking.total_links, sub: `${stats.link_tracking.total_clicks} clicks`, icon: Link, color: 'text-indigo-500' },
    { label: 'Re-Engagement', value: stats.reengagement.total_campaigns, sub: `${stats.reengagement.total_contacts} contacts`, icon: Users, color: 'text-pink-500' },
    { label: 'Broadcast Opt.', value: stats.broadcast_optimizer.total_configs, sub: `${stats.broadcast_optimizer.total_batches} batches`, icon: Radio, color: 'text-orange-500' },
    { label: 'Business Cards', value: stats.business_card.total_cards, sub: `${stats.business_card.total_leads} leads`, icon: ShoppingBag, color: 'text-teal-500' },
  ] : [];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold flex items-center gap-2"><BarChart3 className="w-6 h-6 text-brand-600" /> WhatsApp SaaS Dashboard</h1>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {cards.map((c) => (
          <div key={c.label} className="rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-4">
            <div className="flex items-center gap-2 text-sm text-gray-500 mb-1"><c.icon className={`w-4 h-4 ${c.color}`} /> {c.label}</div>
            <p className="text-2xl font-bold">{c.value}</p>
            <p className="text-xs text-gray-400 mt-1">{c.sub}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
