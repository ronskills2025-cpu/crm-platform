import React, { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard, Users, MessageSquare, Mail, Send, Bot,
  Instagram, BarChart3, Zap, FileText, CreditCard, Inbox,
  ShoppingCart, Rocket, Radio, QrCode, MessageCircle,
  Settings, ChevronDown, ChevronLeft, ChevronRight,
  Package, PanelLeftClose, PanelLeft, Lock
} from 'lucide-react';
import { cn } from '../../../../utils/src/frontend-utils';
import { useAppStore } from '../../stores/appStore';
import toast from 'react-hot-toast';

interface NavItem {
  label: string;
  path: string;
  icon: any;
  children?: { label: string; path: string }[];
  locked?: boolean;
  comingSoon?: boolean;
}

const navigation: NavItem[] = [
  { label: 'Dashboard', path: '/', icon: <LayoutDashboard size={18} /> },
  { label: 'Leads', path: '/leads', icon: <Users size={18} /> },
  
  // WA Chat - ACTIVE (main WhatsApp module)
  { label: 'WA Chat', path: '/wa-chat', icon: <MessageSquare size={18} /> },
  
  // WhatsApp - LOCKED (duplicate, in development)
  {
    label: 'WhatsApp', path: '/whatsapp', icon: <MessageSquare size={18} />, locked: true, comingSoon: true,
    children: [
      { label: 'Dashboard', path: '/whatsapp' },
      { label: 'Campaigns', path: '/whatsapp/campaigns' },
      { label: 'Templates', path: '/whatsapp/templates' },
      { label: 'Analytics', path: '/whatsapp/analytics' },
    ],
  },
  
  // SMS - LOCKED
  {
    label: 'SMS', path: '/sms', icon: <Send size={18} />, locked: true, comingSoon: true,
    children: [
      { label: 'Dashboard', path: '/sms' },
      { label: 'Campaigns', path: '/sms/campaigns' },
      { label: 'Providers', path: '/sms/providers' },
      { label: 'Analytics', path: '/sms/analytics' },
    ],
  },
  
  // Email - LOCKED
  {
    label: 'Email', path: '/email', icon: <Mail size={18} />, locked: true, comingSoon: true,
    children: [
      { label: 'Dashboard', path: '/email' },
      { label: 'Campaigns', path: '/email/campaigns' },
      { label: 'Templates', path: '/email/templates' },
    ],
  },
  
  // Telegram - LOCKED
  {
    label: 'Telegram', path: '/telegram', icon: <Bot size={18} />, locked: true, comingSoon: true,
    children: [
      { label: 'Dashboard', path: '/telegram' },
      { label: 'Campaigns', path: '/telegram/campaigns' },
      { label: 'Bots', path: '/telegram/bots' },
    ],
  },
  
  // Messenger - LOCKED
  {
    label: 'Messenger', path: '/messenger', icon: <MessageCircle size={18} />, locked: true, comingSoon: true,
    children: [
      { label: 'Dashboard', path: '/messenger' },
      { label: 'Campaigns', path: '/messenger/campaigns' },
    ],
  },
  
  // Instagram - LOCKED
  {
    label: 'Instagram', path: '/instagram', icon: <Instagram size={18} />, locked: true, comingSoon: true,
    children: [
      { label: 'Dashboard', path: '/instagram' },
      { label: 'Inbox', path: '/instagram/inbox' },
      { label: 'Comments', path: '/instagram/comment-automation' },
      { label: 'Stories', path: '/instagram/story-automation' },
      { label: 'Lead Bot', path: '/instagram/lead-bot' },
      { label: 'Content', path: '/instagram/content' },
      { label: 'Analytics', path: '/instagram/analytics' },
    ],
  },
  
  // Inbox - LOCKED
  { label: 'Inbox', path: '/inbox', icon: <Inbox size={18} />, locked: true, comingSoon: true },
  
  // Automation - LOCKED
  { label: 'Automation', path: '/automation', icon: <Zap size={18} />, locked: true, comingSoon: true },
  
  // Analytics - ACTIVE
  { label: 'Analytics', path: '/analytics', icon: <BarChart3 size={18} /> },
  
  // Products - LOCKED
  {
    label: 'Products', path: '/products', icon: <Package size={18} />, locked: true, comingSoon: true,
    children: [
      { label: 'Dashboard', path: '/products' },
      { label: 'Funnels', path: '/products/funnel' },
      { label: 'Appointments', path: '/products/appointments' },
      { label: 'Payment Bot', path: '/products/payment-bot' },
      { label: 'Reviews', path: '/products/reviews' },
      { label: 'Events', path: '/products/events' },
      { label: 'Catalog', path: '/products/catalog' },
      { label: 'Surveys', path: '/products/surveys' },
      { label: 'Memberships', path: '/products/memberships' },
    ],
  },
  
  // Growth - LOCKED
  {
    label: 'Growth', path: '/growth', icon: <Rocket size={18} />, locked: true, comingSoon: true,
    children: [
      { label: 'Dashboard', path: '/growth' },
      { label: 'Lead Capture', path: '/growth/lead-capture' },
      { label: 'Missed Call', path: '/growth/missed-call' },
      { label: 'Follow-ups', path: '/growth/followups' },
      { label: 'Loyalty', path: '/growth/loyalty' },
      { label: 'Referral', path: '/growth/referral' },
      { label: 'Reviews', path: '/growth/review-booster' },
      { label: 'Pipeline', path: '/growth/pipeline' },
      { label: 'Broadcast', path: '/growth/broadcast' },
      { label: 'Ads', path: '/growth/ads' },
      { label: 'Websites', path: '/growth/websites' },
    ],
  },
  
  
  // Cart Recovery - LOCKED
  { label: 'Cart Recovery', path: '/cart-recovery', icon: <ShoppingCart size={18} />, locked: true, comingSoon: true },
  
  // Clients - LOCKED
  { label: 'Clients', path: '/clients', icon: <Users size={18} />, locked: true, comingSoon: true },
  
  // Billing - ACTIVE
  { label: 'Billing', path: '/billing', icon: <CreditCard size={18} /> },
];

function NavGroup({ item, collapsed }: { item: NavItem; collapsed: boolean }) {
  const location = useLocation();
  const isActive = location.pathname === item.path || location.pathname.startsWith(item.path + '/');
  const [open, setOpen] = useState(isActive);

  const handleClick = (e: any) => {
    if (item.locked) {
      e.preventDefault();
      toast.error(item.comingSoon ? 'Coming Soon - In Development' : 'Feature Locked');
      return;
    }
  };

  if (!item.children) {
    if (item.locked) {
      return (
        <button
          onClick={handleClick}
          className={cn(
            'w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-all duration-200',
            'text-[var(--text-muted)] cursor-not-allowed opacity-60 border border-transparent',
            collapsed && 'justify-center px-2'
          )}
        >
          <span className="shrink-0 relative">
            {item.icon}
            <Lock size={10} className="absolute -top-1 -right-1 text-[var(--text-muted)]" />
          </span>
          {!collapsed && (
            <span className="truncate flex items-center gap-2">
              {item.label}
              {item.comingSoon && <span className="text-xs bg-[var(--bg-elevated)] text-[var(--text-muted)] px-1.5 py-0.5 rounded">Soon</span>}
            </span>
          )}
        </button>
      );
    }

    return (
      <NavLink
        to={item.path}
        className={({ isActive: active }: { isActive: boolean }) => cn(
          'flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-all duration-200',
          active
            ? 'bg-[var(--accent-primary)]/10 text-[var(--accent-primary)] border border-[var(--accent-primary)]/20'
            : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] border border-transparent',
          collapsed && 'justify-center px-2'
        )}
        end={item.path === '/'}
      >
        <span className="shrink-0">{item.icon}</span>
        {!collapsed && <span className="truncate">{item.label}</span>}
      </NavLink>
    );
  }

  return (
    <div>
      <button
        onClick={item.locked ? handleClick : () => setOpen(!open)}
        className={cn(
          'w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-all duration-200',
          item.locked
            ? 'text-[var(--text-muted)] cursor-not-allowed opacity-60'
            : isActive
            ? 'text-[var(--accent-primary)]'
            : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]',
          collapsed && 'justify-center px-2'
        )}
      >
        <span className="shrink-0 relative">
          {item.icon}
          {item.locked && <Lock size={10} className="absolute -top-1 -right-1 text-[var(--text-muted)]" />}
        </span>
        {!collapsed && (
          <>
            <span className="truncate flex-1 text-left flex items-center gap-2">
              {item.label}
              {item.locked && item.comingSoon && <span className="text-xs bg-[var(--bg-elevated)] text-[var(--text-muted)] px-1.5 py-0.5 rounded">Soon</span>}
            </span>
            {!item.locked && (
              <ChevronDown
                size={14}
                className={cn('transition-transform duration-200', open && 'rotate-180')}
              />
            )}
          </>
        )}
      </button>
      <AnimatePresence>
        {open && !collapsed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="ml-5 pl-3 border-l border-[var(--border-subtle)] space-y-0.5 mt-1 mb-1">
              {item.children.map((child) => (
                <NavLink
                  key={child.path}
                  to={child.path}
                  className={({ isActive: active }: { isActive: boolean }) => cn(
                    'block px-3 py-1.5 rounded-lg text-xs font-medium transition-colors duration-150',
                    active
                      ? 'text-[var(--accent-primary)] bg-[var(--accent-primary)]/10'
                      : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'
                  )}
                  end
                >
                  {child.label}
                </NavLink>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function Sidebar() {
  const { sidebarOpen, toggleSidebar } = useAppStore();
  const collapsed = !sidebarOpen;

  return (
    <aside
      className={cn(
        'fixed top-0 left-0 h-screen z-30 flex flex-col',
        'bg-[var(--bg-surface)] border-r border-[var(--border-subtle)]',
        'transition-[width] duration-[220ms] ease-in-out',
        collapsed ? 'w-16' : 'w-[248px]'
      )}
    >
      {/* Logo */}
      <div className={cn(
        'h-14 flex items-center border-b border-[var(--border-subtle)] px-4',
        collapsed ? 'justify-center' : 'gap-3'
      )}>
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shrink-0">
          <span className="text-white font-bold text-sm">C</span>
        </div>
        {!collapsed && (
          <span className="text-base font-bold text-[var(--text-primary)] tracking-tight">CRM</span>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5 scrollbar-thin">
        {navigation.map((item) => (
          <NavGroup key={item.path + item.label} item={item} collapsed={collapsed} />
        ))}
      </nav>

      {/* Collapse toggle */}
      <div className="border-t border-[var(--border-subtle)] p-2">
        <button
          onClick={toggleSidebar}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl
                     text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]
                     transition-colors duration-200 text-xs"
        >
          {collapsed ? <PanelLeft size={16} /> : <PanelLeftClose size={16} />}
          {!collapsed && <span>Collapse</span>}
        </button>
      </div>
    </aside>
  );
}

