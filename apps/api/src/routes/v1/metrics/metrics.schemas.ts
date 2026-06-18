import { z } from '@hono/zod-openapi';

export const CreateMetricParams = z.object({
  projectId: z.uuid().openapi({
    param: { name: 'projectId', in: 'path' },
    example: 'd6ceaf26-fd71-4c38-90f1-2de20b946d00',
  }),
});

export const METRIC_AGGREGATIONS = ['count', 'sum', 'average'] as const;

const CreateMetricEvent = z
  .object({
    key: z.string().openapi({ example: 'signup_completion' }),
    source: z.string().openapi({ example: 'posthog' }),
    type: z.string().openapi({ example: 'completed.signup' }),
    aggregation: z
      .enum(METRIC_AGGREGATIONS, {
        error: `Invalid aggregation. Valid values are: ${METRIC_AGGREGATIONS.join(', ')}.`,
      })
      .openapi({ example: 'count' }),
    field: z.string().nullish().openapi({
      example: '$properties.amount_usd',
    }),
  })
  .refine((e) => e.aggregation === 'count' || e.field != null, {
    error: 'The field is required for sum and average aggregations.',
    path: ['field'],
  })
  .refine((e) => e.aggregation !== 'count' || e.field == null, {
    error: 'The field must not be set for count aggregation.',
    path: ['field'],
  });

const CreateMetricDefinition = z
  .object({
    events: z
      .array(CreateMetricEvent)
      .min(1, 'A metric must have at least one event.')
      .openapi({ description: 'Events that affect a metric.' }),
    value: z.string().trim().min(1, 'The value expression must not be empty.').optional().openapi({
      description:
        'Expression combining per-event aggregated results. Defaults to the single event key when only one event is defined.',
    }),
  })
  .refine((d) => new Set(d.events.map((e) => e.key)).size === d.events.length, {
    error: 'Event keys must be unique within a metric.',
    path: ['events'],
  })
  .refine((d) => d.value != null || d.events.length === 1, {
    error: 'The field is required when a metric has more than one event.',
    path: ['value'],
  });

export const CreateMetricRequest = z.object({
  name: z.string().min(1, 'The name must not be empty.').openapi({
    example: 'Monthly Active Users',
  }),
  description: z.string().nullish().openapi({
    example: 'Count of distinct users active in the last 30 days.',
  }),
  definition: CreateMetricDefinition,
});

export const CreateMetricResponse = z.object({
  id: z.uuid(),
  name: z.string(),
  description: z.string().nullish(),
  definition: CreateMetricDefinition,
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
