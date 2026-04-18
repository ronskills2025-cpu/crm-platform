import { type ReactNode, type HTMLAttributes } from 'react';
import { motion, type HTMLMotionProps } from 'framer-motion';
import { cn } from '../../../../utils/src/frontend-utils';

export interface StatCardProps extends HTMLAttributes<HTMLDivElement> {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: ReactNode;
  trend?: { value: number; label?: string };
  color?: 'blue' | 'purple' | 'emerald' | 'amber' | 'red';
  animated?: boolean;
}

const iconColors = {
  blue:    'text-blue-400 bg-blue-500/10 border-blue-500/20',
  purple:  'text-purple-400 bg-purple-500/10 border-purple-500/20',
  emerald: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  amber:   'text-amber-400 bg-amber-500/10 border-amber-500/20',
  red:     'text-red-400 bg-red-500/10 border-red-500/20',
};

export function StatCard({
  title, value, subtitle, icon, trend, color = 'blue', animated = true, className, ...props
}: StatCardProps) {
  const Wrapper = animated ? motion.div : 'div';
  const motionProps = animated ? {
    initial: { opacity: 0, y: 12 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.3, ease: [0.4, 0, 0.2, 1] },
  } as HTMLMotionProps<'div'> : {};

  return (
    <Wrapper
      className={cn('card card-interactive p-5 flex flex-col gap-3', className)}
      {...motionProps}
      {...(props as any)}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">{title}</span>
        {icon && (
          <span className={cn('p-2 rounded-lg border', iconColors[color])}>
            {icon}
          </span>
        )}
      </div>
      <div>
        <p className="text-2xl font-bold text-white tracking-tight">{value}</p>
        <div className="flex items-center gap-2 mt-1">
          {trend && (
            <span className={cn(
              'text-xs font-medium',
              trend.value >= 0 ? 'text-emerald-400' : 'text-red-400'
            )}>
              {trend.value >= 0 ? '↑' : '↓'} {Math.abs(trend.value)}%
              {trend.label && <span className="text-gray-500 ml-1">{trend.label}</span>}
            </span>
          )}
          {subtitle && !trend && (
            <span className="text-xs text-gray-500">{subtitle}</span>
          )}
        </div>
      </div>
    </Wrapper>
  );
}

