import { cn } from '../../../../utils/src/frontend-utils';

export interface SectionProps extends React.HTMLAttributes<HTMLElement> {
  children: React.ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
}

const widthMap = {
  sm: 'max-w-3xl',
  md: 'max-w-5xl',
  lg: 'max-w-7xl',
  xl: 'max-w-[90rem]',
  full: 'max-w-full',
};

export function Section({ maxWidth = 'lg', className, children, ...props }: SectionProps) {
  return (
    <section
      className={cn('mx-auto w-full px-4 md:px-6', widthMap[maxWidth], className)}
      {...props}
    >
      {children}
    </section>
  );
}

