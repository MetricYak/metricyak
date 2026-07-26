import type * as React from 'react';
import { ResponsiveContainer } from 'recharts';
import { cn } from '@/lib/utils';

export const CHART_SLOT_VARS: readonly string[] = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
  'var(--chart-6)',
];

export function chartStrokeFor(index: number): string {
  return CHART_SLOT_VARS[index] ?? 'var(--chart-other)';
}

export function ChartContainer({
  height = 260,
  className,
  children,
}: {
  height?: number | string;
  className?: string;
  children: React.ReactElement;
}): React.JSX.Element {
  return (
    <div className={cn('w-full', className)} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        {children}
      </ResponsiveContainer>
    </div>
  );
}

export function ChartTooltipCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <div className="rounded-md border border-border bg-popover px-3 py-2 text-popover-foreground shadow-xl">
      <p className="font-medium text-xs">{title}</p>
      <div className="mt-1.5 space-y-1">{children}</div>
    </div>
  );
}
