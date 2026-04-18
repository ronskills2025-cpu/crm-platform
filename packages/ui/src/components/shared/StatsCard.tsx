import { type LucideIcon } from 'lucide-react';
import { cn } from '../../../../utils/src/frontend-utils';

export interface StatsCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  color?: string;
  trend?: number;
}

export function StatsCard({ title, value, subtitle, icon: Icon, color = 'bg-blue-600', trend }: StatsCardProps) {
  return (
    <div className="card card-interactive p-5 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">{title}</span>
        <span className={cn('p-2 rounded-lg', color, 'bg-opacity-20')}>
          <Icon size={18} className="text-current" />
        </span>
      </div>
      <div>
        <p className="text-2xl font-bold text-white tracking-tight">{value}</p>
        {trend !== undefined && (
          <span className={cn('text-xs font-medium', trend >= 0 ? 'text-emerald-400' : 'text-red-400')}>
            {trend >= 0 ? '↑' : '↓'} {Math.abs(trend)}%
          </span>
        )}
        {subtitle && <span className="text-xs text-gray-500">{subtitle}</span>}
      </div>
    </div>
  );
}

