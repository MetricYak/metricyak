import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface SidePanelBodyProps {
  className?: string;
  children: ReactNode;
}

export function SidePanelBody({ className, children }: SidePanelBodyProps): React.JSX.Element {
  return (
    <div className={cn('flex-1 overflow-y-auto overflow-x-hidden p-2', className)}>{children}</div>
  );
}
