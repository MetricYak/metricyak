import { z } from 'zod';
import { METRIC_AGGREGATIONS, type MetricDefinition } from '@/api/metrics';

export const eventFormSchema = z
  .object({
    key: z.string().trim().min(1, 'Give this event a short name to refer to it by.'),
    source: z.string().trim().min(1, "Where does this event come from, e.g. 'web'?"),
    type: z.string().trim().min(1, 'Which event should we match?'),
    aggregation: z.enum(METRIC_AGGREGATIONS),
    field: z.string().trim().optional(),
  })
  .superRefine((event, ctx) => {
    if (event.aggregation !== 'count' && !event.field) {
      ctx.addIssue({
        code: 'custom',
        message: `Pick the numeric field to ${event.aggregation}.`,
        path: ['field'],
      });
    }
  });

export const metricFormSchema = z
  .object({
    name: z.string().trim().min(1, 'Give your metric a name.'),
    description: z.string().trim().optional(),
    events: z.array(eventFormSchema).min(1),
    value: z.string().trim().optional(),
    dimensions: z.array(z.string().trim().min(1)).max(16).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.events.length > 1 && !data.value) {
      ctx.addIssue({
        code: 'custom',
        message: 'Combine your events with a formula, e.g. checkout - refund.',
        path: ['value'],
      });
    }
    const keys = data.events.map((event) => event.key);
    if (new Set(keys).size !== keys.length) {
      ctx.addIssue({
        code: 'custom',
        message: 'Give each event a different name — two events are using the same one.',
        path: ['events', keys.length - 1, 'key'],
      });
    }
  });

export type MetricFormValues = z.infer<typeof metricFormSchema>;
export type EventFormValues = z.infer<typeof eventFormSchema>;

export function emptyEvent(): EventFormValues {
  return { key: '', source: '', type: '', aggregation: 'count', field: '' };
}

export const defaultMetricFormValues: MetricFormValues = {
  name: '',
  description: '',
  events: [emptyEvent()],
  value: '',
  dimensions: [],
};

export function toMetricDefinition(values: MetricFormValues): MetricDefinition {
  const events = values.events ?? [];
  return {
    events: events.map((event) => ({
      key: event.key,
      source: event.source,
      type: event.type,
      aggregation: event.aggregation,
      field: event.aggregation === 'count' ? undefined : event.field,
    })),
    value: events.length > 1 ? values.value : undefined,
    dimensions: values.dimensions?.length ? values.dimensions : undefined,
  };
}
