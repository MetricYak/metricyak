import { LineChart } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Surface } from '@/components/ui/surface';
import { useProjectRoute } from '@/hooks/useProjectRoute';

export function MetricValueSlot({
  variant,
  metricId,
}: {
  variant: 'row' | 'panel';
  metricId?: string;
}): React.JSX.Element {
  const { to } = useProjectRoute();
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

  if (!metricId) return <span />;

  return (
    <Surface
      padding="none"
      className="flex flex-col items-center justify-center gap-2 px-4 py-8 text-center"
    >
      <LineChart className="size-5 text-muted-foreground" />
      <p className="font-medium text-foreground text-sm">See how this metric moves</p>
      <p className="max-w-xs text-muted-foreground text-sm">
        Chart it over time, split it by a dimension, and open the events behind any point.
      </p>
      <Button asChild className="raised mt-1">
        <Link to={to(`/metrics/explore?m=${encodeURIComponent(metricId)}`)}>
          <LineChart className="size-4" />
          Explore this metric
        </Link>
      </Button>
    </Surface>
  );
}
