import { LineChart } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { Metric } from '@/api/metrics';
import { useProjectRoute } from '@/hooks/useProjectRoute';
import { cn } from '@/lib/utils';
import { summarizeDefinition } from './format';
import { MetricValueSlot } from './MetricValueSlot';

export function MetricListRow({
  metric,
  selected,
  onSelect,
}: {
  metric: Metric;
  selected: boolean;
  onSelect: () => void;
}): React.JSX.Element {
  const { to } = useProjectRoute();

  return (
    <div
      className={cn(
        'group/row flex w-full items-center gap-2 rounded-lg pr-2 transition-colors',
        selected ? 'bg-primary/10' : 'hover:bg-metricyak-50',
      )}
    >
      <button
        type="button"
        onClick={onSelect}
        aria-current={selected ? 'true' : undefined}
        className="flex min-w-0 flex-1 items-center gap-3 px-3 py-2.5 text-left"
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium text-foreground text-sm">{metric.name}</span>
          <span className="block truncate text-muted-foreground text-xs">
            {summarizeDefinition(metric.definition)}
          </span>
        </span>
        <MetricValueSlot variant="row" />
      </button>

      <Link
        to={to(`/metrics/explore?m=${encodeURIComponent(metric.id)}`)}
        aria-label={`Explore ${metric.name}`}
        title="Explore over time"
        className="shrink-0 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-metricyak-100 hover:text-brand-orange-text"
      >
        <LineChart className="size-4" />
      </Link>
    </div>
  );
}
