import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

const WIDTHS = {
  narrow: 'max-w-3xl',
  content: 'max-w-5xl',
  wide: 'max-w-[100rem]',
} as const;

export type PageWidth = keyof typeof WIDTHS;

interface PageContainerProps {
  width?: PageWidth;
  className?: string;
  children: ReactNode;
}

export function PageContainer({
  width = 'wide',
  className,
  children,
}: PageContainerProps): React.JSX.Element {
  return (
    <div className={cn('mx-auto w-full px-6 md:px-8', WIDTHS[width], className)}>{children}</div>
  );
}
