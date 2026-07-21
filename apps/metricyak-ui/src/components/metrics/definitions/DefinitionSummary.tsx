import type { MetricDefinition } from '@/api/metrics';
import { Badge } from '@/components/ui/badge';

const AGGREGATION_LABEL: Record<string, string> = {
  count: 'Count',
  sum: 'Sum',
  average: 'Average',
  min: 'Min',
  max: 'Max',
};

export function DefinitionSummary({
  definition,
}: {
  definition: MetricDefinition;
}): React.JSX.Element {
  const { events, value, dimensions } = definition;

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        {events.map((event, index) => {
          const aggregation = (
            AGGREGATION_LABEL[event.aggregation] ?? event.aggregation
          ).toLowerCase();
          return (
            // biome-ignore lint/suspicious/noArrayIndexKey: event rows are positional in a small, live-edited list
            <div key={index} className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-sm">
              {event.key ? (
                <code className="rounded bg-muted px-1.5 py-0.5 font-medium text-foreground text-xs">
                  {event.key}
                </code>
              ) : null}
              <span className="text-muted-foreground">
                {aggregation}
                {event.aggregation === 'count' ? '' : ` of ${event.field || '…'}`} on{' '}
                {event.type ? (
                  <span className="text-foreground">{event.type}</span>
                ) : (
                  <span>an event</span>
                )}
                {event.source ? ` from ${event.source}` : ''}
              </span>
            </div>
          );
        })}
      </div>

      {value ? (
        <div className="border-border border-t pt-3 text-sm">
          <span className="text-muted-foreground">Combined as </span>
          <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-foreground text-xs">
            {value}
          </code>
        </div>
      ) : null}

      {dimensions?.length ? (
        <div className="flex flex-wrap items-center gap-1.5 border-border border-t pt-3">
          <span className="text-muted-foreground text-sm">Breaks down by</span>
          {dimensions.map((dimension) => (
            <Badge key={dimension} variant="outline">
              {dimension}
            </Badge>
          ))}
        </div>
      ) : null}
    </div>
  );
}
