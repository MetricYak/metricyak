import { z } from '@hono/zod-openapi';
import { METRIC_AGGREGATIONS } from '@metricyak/storage';
import { expressionVariables, parseExpression } from '@/modules/aggregates/engine/expression.js';

export const CreateMetricParams = z.object({
  projectId: z.uuid().openapi({
    param: { name: 'projectId', in: 'path' },
    example: 'd6ceaf26-fd71-4c38-90f1-2de20b946d00',
  }),
});

const CreateMetricEvent = z
  .object({
    key: z.string().min(1, 'The key must not be empty.').openapi({ example: 'signup_completion' }),
    source: z.string().min(1, 'The source must not be empty.').openapi({ example: 'posthog' }),
    type: z.string().min(1, 'The type must not be empty.').openapi({ example: 'completed.signup' }),
    aggregation: z
      .enum(METRIC_AGGREGATIONS, {
        error: `Invalid aggregation. Valid values are: ${METRIC_AGGREGATIONS.join(', ')}.`,
      })
      .openapi({ example: 'count' }),
    field: z.string().nullish().openapi({
      example: '$properties.amount_usd',
    }),
  })
  .refine((event) => event.aggregation === 'count' || event.field != null, {
    error: 'The field is required for sum, average, min, and max aggregations.',
    path: ['field'],
  })
  .refine((event) => event.aggregation !== 'count' || event.field == null, {
    error: 'The field must not be set for count aggregation.',
    path: ['field'],
  });

const Dimensions = z
  .array(z.string().min(1, 'A dimension must not be empty.'))
  .max(16, 'A metric may declare at most 16 dimensions.')
  .optional()
  .openapi({ description: 'Event property keys to pre-aggregate for breakdowns.' });

const MetricDefinitionFields = z.object({
  events: z
    .array(CreateMetricEvent)
    .min(1, 'A metric must have at least one event.')
    .openapi({ description: 'Events that affect a metric.' }),
  value: z.string().trim().min(1, 'The value expression must not be empty.').optional().openapi({
    description:
      'Expression combining per-event aggregated results. Defaults to the single event key when only one event is defined.',
  }),
  dimensions: Dimensions,
});

function validateExpression(
  expression: string,
  allowed: ReadonlySet<string>,
  ctx: z.RefinementCtx,
): void {
  let variables: string[];
  try {
    variables = expressionVariables(parseExpression(expression));
  } catch {
    ctx.addIssue({ code: 'custom', message: 'The value expression is invalid.', path: ['value'] });
    return;
  }

  const unknown = variables.filter((variable) => !allowed.has(variable));
  if (unknown.length > 0) {
    ctx.addIssue({
      code: 'custom',
      message: `The value expression references unknown identifiers: ${unknown.join(', ')}.`,
      path: ['value'],
    });
  }
}

const CreateMetricDefinition = MetricDefinitionFields.superRefine((definition, ctx) => {
  const keys = new Set(definition.events.map((event) => event.key));
  if (keys.size !== definition.events.length) {
    ctx.addIssue({
      code: 'custom',
      message: 'Event keys must be unique within a metric.',
      path: ['events'],
    });
  }
  if (definition.value == null && definition.events.length > 1) {
    ctx.addIssue({
      code: 'custom',
      message: 'The value expression is required when a metric has more than one event.',
      path: ['value'],
    });
  }
  if (definition.value != null) {
    validateExpression(definition.value, keys, ctx);
  }
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
  definition: MetricDefinitionFields,
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
