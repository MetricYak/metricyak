import type { Metric } from '@/api/metrics';
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
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-current={selected ? 'true' : undefined}
      className={cn(
        'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors',
        selected ? 'bg-primary/10' : 'hover:bg-metricyak-50',
      )}
    >
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium text-foreground text-sm">{metric.name}</span>
        <span className="block truncate text-muted-foreground text-xs">
          {summarizeDefinition(metric.definition)}
        </span>
      </span>
      <MetricValueSlot variant="row" />
    </button>
  );
}
