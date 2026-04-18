import { cn } from '../../../../utils/src/frontend-utils';

export interface GridProps extends React.HTMLAttributes<HTMLDivElement> {
  cols?: 1 | 2 | 3 | 4 | 5 | 6;
  gap?: 'sm' | 'md' | 'lg';
  children: React.ReactNode;
}

const colsMap = {
  1: 'grid-cols-1',
  2: 'grid-cols-1 sm:grid-cols-2',
  3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
  4: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4',
  5: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5',
  6: 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6',
};

const gapMap = {
  sm: 'gap-3',
  md: 'gap-4',
  lg: 'gap-6',
};

export function Grid({ cols = 3, gap = 'md', className, children, ...props }: GridProps) {
  return (
    <div className={cn('grid', colsMap[cols], gapMap[gap], className)} {...props}>
      {children}
    </div>
  );
}

