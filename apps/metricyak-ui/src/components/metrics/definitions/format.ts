import type { MetricDefinition } from '@/api/metrics';

const AGGREGATION_LABEL: Record<string, string> = {
  count: 'Count',
  sum: 'Sum',
  average: 'Average',
  min: 'Min',
  max: 'Max',
};

export function summarizeDefinition(definition: MetricDefinition): string {
  const { events } = definition;
  const event = events[0];
  if (!event) return 'No events';
  if (events.length === 1) {
    const label = AGGREGATION_LABEL[event.aggregation] ?? event.aggregation;
    return event.aggregation === 'count'
      ? `${label} of ${event.key}`
      : `${label} of ${event.field}`;
  }
  return `${events.length} events combined`;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function formatDateAgo(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '—';
  const days = Math.floor((Date.now() - then) / DAY_MS);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 30) return `${days} days ago`;
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(then));
}
