// ══════════════════════════════════════════════════════════════
// CRM Design System — packages/ui
// ══════════════════════════════════════════════════════════════

// ── UI Components ─────────────────────────────────────────────
export { Card, CardHeader, CardTitle } from './components/ui/Card';
export type { CardProps } from './components/ui/Card';

export { Button } from './components/ui/Button';
export type { ButtonProps } from './components/ui/Button';

export { Badge } from './components/ui/Badge';
export type { BadgeProps } from './components/ui/Badge';

export { Heading } from './components/ui/Heading';
export type { HeadingProps } from './components/ui/Heading';

export { Input, Select } from './components/ui/Input';
export type { InputProps, SelectProps } from './components/ui/Input';

export { Modal } from './components/ui/Modal';
export type { ModalProps } from './components/ui/Modal';

export { StatCard } from './components/ui/StatCard';
export type { StatCardProps } from './components/ui/StatCard';

export { Section } from './components/ui/Section';
export type { SectionProps } from './components/ui/Section';

export { Skeleton, PageSkeleton, TableSkeleton } from './components/ui/Skeleton';

export { Pagination } from './components/ui/Pagination';
export type { PaginationProps } from './components/ui/Pagination';

// ── Layout Components ─────────────────────────────────────────
export { Sidebar } from './components/layout/Sidebar';
export { Topbar } from './components/layout/Topbar';
export { default as AdminLayout } from './components/layout/AdminLayout';
export { PageContainer } from './components/layout/PageContainer';
export { Grid } from './components/layout/Grid';

// ── Shared Components ─────────────────────────────────────────
export { GlobalDashboard } from './components/shared/GlobalDashboard';
export { default as PlaceholderPage } from './components/shared/PlaceholderPage';
export { ActivityFeed } from './components/shared/ActivityFeed';
export type { ActivityItem } from './components/shared/ActivityFeed';

export { StatsCard as DashboardStatsCard } from './components/shared/StatsCard';

// ── Theme Components ─────────────────────────────────────────
export { ThemeProvider, useTheme } from './components/ThemeProvider';
export { ThemeToggle } from './components/ThemeToggle';

// ── Stores ────────────────────────────────────────────────────
export { useAppStore } from './stores/appStore';

// ── Hooks ─────────────────────────────────────────────────────
export { useRealtimeEvents } from './hooks/useRealtimeEvents';
export { useDebounce, useDebouncedCallback } from './hooks/useDebounce';
