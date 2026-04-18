import { type ReactNode, type HTMLAttributes } from 'react';
import { cn } from '../../../../utils/src/frontend-utils';

type HeadingLevel = 'h1' | 'h2' | 'h3' | 'h4';

export interface HeadingProps extends HTMLAttributes<HTMLHeadingElement> {
  as?: HeadingLevel;
  gradient?: boolean;
  subtitle?: string;
  children: ReactNode;
}

const sizeMap: Record<HeadingLevel, string> = {
  h1: 'text-2xl md:text-3xl font-bold tracking-tight',
  h2: 'text-xl md:text-2xl font-bold tracking-tight',
  h3: 'text-lg font-semibold',
  h4: 'text-base font-semibold',
};

export function Heading({ as: Tag = 'h2', gradient = false, subtitle, className, children, ...props }: HeadingProps) {
  return (
    <div className="space-y-1">
      <Tag
        className={cn(
          sizeMap[Tag],
          gradient ? 'text-gradient' : 'text-white',
          className
        )}
        {...props}
      >
        {children}
      </Tag>
      {subtitle && (
        <p className="text-sm text-gray-400">{subtitle}</p>
      )}
    </div>
  );
}

