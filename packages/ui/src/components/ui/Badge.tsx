import { type ReactNode, type HTMLAttributes } from 'react';
import { cn } from '../../../../utils/src/frontend-utils';

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'success' | 'warning' | 'error' | 'info' | 'purple';
  dot?: boolean;
  children: ReactNode;
}

const variantMap = {
  default: 'badge-default',
  success: 'badge-success',
  warning: 'badge-warning',
  error: 'badge-error',
  info: 'badge-info',
  purple: 'badge-purple',
};

const dotColors = {
  default: 'bg-gray-400',
  success: 'bg-emerald-400',
  warning: 'bg-amber-400',
  error: 'bg-red-400',
  info: 'bg-blue-400',
  purple: 'bg-purple-400',
};

export function Badge({ variant = 'default', dot = false, className, children, ...props }: BadgeProps) {
  return (
    <span className={cn(variantMap[variant], className)} {...props}>
      {dot && <span className={cn('w-1.5 h-1.5 rounded-full', dotColors[variant])} />}
      {children}
    </span>
  );
}

