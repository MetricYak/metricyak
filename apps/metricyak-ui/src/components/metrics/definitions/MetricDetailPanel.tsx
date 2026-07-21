import { Check } from 'lucide-react';
import type { Metric } from '@/api/metrics';
import { Surface } from '@/components/ui/surface';
import { DefinitionSummary } from './DefinitionSummary';
import { formatDateAgo } from './format';
import { MetricValueSlot } from './MetricValueSlot';
import { MonitorComingSoon } from './MonitorComingSoon';

export function MetricDetailPanel({
  metric,
  justCreated = false,
}: {
  metric: Metric;
  justCreated?: boolean;
}): React.JSX.Element {
  return (
    <div className="space-y-6">
      {justCreated ? (
        <Surface padding="none" className="flex items-center gap-2 px-4 py-2.5 text-sm">
          <Check className="size-4 shrink-0 text-metricyak-brand-orange" />
          <span className="font-medium text-foreground">Metric created.</span>
          <span className="text-muted-foreground">
            It starts filling in as matching events arrive.
          </span>
        </Surface>
      ) : null}

      <div>
        <h2 className="font-semibold text-foreground text-xl">{metric.name}</h2>
        {metric.description ? (
          <p className="mt-1 text-muted-foreground text-sm">{metric.description}</p>
        ) : null}
        <p className="mt-2 text-muted-foreground text-xs">
          Created {formatDateAgo(metric.createdAt).toLowerCase()}
        </p>
      </div>

      <MetricValueSlot variant="panel" />

      <section>
        <h3 className="font-semibold text-foreground text-sm">Definition</h3>
        <Surface className="mt-2">
          <DefinitionSummary definition={metric.definition} />
        </Surface>
      </section>

      <MonitorComingSoon metricName={metric.name} />
    </div>
  );
}
