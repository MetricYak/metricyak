import type { MetricDefinition } from '@/api/metrics';

export function yDomainFor(definition: MetricDefinition): [0 | 'auto', 'auto'] {
  const anyAdditive = definition.events.some(
    (event) => event.aggregation === 'count' || event.aggregation === 'sum',
  );
  return anyAdditive ? [0, 'auto'] : ['auto', 'auto'];
}
