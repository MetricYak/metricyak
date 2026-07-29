import type { Metric, MetricDefinition, MetricEvent } from '@/api/metrics';
import type { ExploreMetric, MetricKind, ValueFormat } from './explore-model';

const ADDITIVE_KINDS: readonly MetricKind[] = ['count', 'sum'];

export function isAdditive(kind: MetricKind): boolean {
  return ADDITIVE_KINDS.includes(kind);
}

function divides(expression: string | undefined): boolean {
  return expression?.includes('/') ?? false;
}

function metricKindOf(definition: MetricDefinition): MetricKind {
  if (divides(definition.value)) return 'ratio';
  return definition.events[0]?.aggregation ?? 'count';
}

function countsOnly(events: readonly MetricEvent[]): boolean {
  return events.length > 0 && events.every((event) => event.aggregation === 'count');
}

function valueFormatOf(definition: MetricDefinition, kind: MetricKind): ValueFormat {
  if (kind === 'ratio') return countsOnly(definition.events) ? 'percent' : 'decimal';
  return kind === 'count' ? 'integer' : 'decimal';
}

function eventExpression(event: MetricEvent): string {
  const subject = event.field ? `${event.type}.${event.field}` : event.type;
  return `${event.aggregation}(${subject})`;
}

function expressionOf(definition: MetricDefinition): string {
  const single = definition.events[0];
  if (!definition.value) return single ? eventExpression(single) : '';
  const expressionsByKey = new Map(
    definition.events.map((event) => [event.key, eventExpression(event)] as const),
  );
  return definition.value.replace(
    /[A-Za-z_][A-Za-z0-9_]*/g,
    (token) => expressionsByKey.get(token) ?? token,
  );
}

export function toExploreMetric(metric: Metric): ExploreMetric {
  const kind = metricKindOf(metric.definition);
  return {
    id: metric.id,
    name: metric.name,
    description: metric.description ?? null,
    expression: expressionOf(metric.definition),
    kind,
    valueFormat: valueFormatOf(metric.definition, kind),
    dimensions: metric.definition.dimensions ?? [],
  };
}
