import { LineChart } from 'lucide-react';
import { Surface } from '@/components/ui/surface';

export function MetricValueSlot({ variant }: { variant: 'row' | 'panel' }): React.JSX.Element {
  if (variant === 'row') {
    return (
      <span
        className="flex shrink-0 items-center gap-2 text-muted-foreground"
        title="Live values coming soon"
      >
        <svg
          width="40"
          height="12"
          viewBox="0 0 40 12"
          fill="none"
          aria-hidden="true"
          className="opacity-40"
        >
          <line
            x1="0"
            y1="10"
            x2="40"
            y2="10"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeDasharray="3 3"
          />
        </svg>
        <span className="w-6 text-right text-xs tabular-nums">—</span>
      </span>
    );
  }

  return (
    <Surface
      padding="none"
      className="flex flex-col items-center justify-center gap-1 px-4 py-8 text-center"
    >
      <LineChart className="size-5 text-muted-foreground" />
      <p className="font-medium text-foreground text-sm">Live values coming soon</p>
      <p className="max-w-xs text-muted-foreground text-sm">
        This metric's current value and trend will show here once values start rolling up.
      </p>
    </Surface>
  );
}
