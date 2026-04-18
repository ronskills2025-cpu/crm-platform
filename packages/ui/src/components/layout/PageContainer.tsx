import { cn } from '../../../../utils/src/frontend-utils';

export interface PageContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export function PageContainer({ className, children, ...props }: PageContainerProps) {
  return (
    <div
      className={cn('flex-1 p-4 md:p-6 max-w-7xl mx-auto w-full', className)}
      {...props}
    >
      {children}
    </div>
  );
}

