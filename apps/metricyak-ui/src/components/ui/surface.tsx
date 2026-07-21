import type * as React from 'react';
import { cn } from '@/lib/utils';

const PADDING = {
  none: '',
  sm: 'p-3',
  md: 'p-4',
  lg: 'p-5',
} as const;

interface SurfaceProps extends React.ComponentProps<'div'> {
  padding?: keyof typeof PADDING;
}

export function Surface({ padding = 'md', className, ...props }: SurfaceProps): React.JSX.Element {
  return (
    <div
      data-slot="surface"
      className={cn(
        'rounded-lg border border-border bg-card shadow-sm',
        PADDING[padding],
        className,
      )}
      {...props}
    />
  );
}
