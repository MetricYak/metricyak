import { z } from '@hono/zod-openapi';

export const CreateMonitorParams = z.object({
  projectId: z.uuid().openapi({
    param: { name: 'projectId', in: 'path' },
    example: 'd6ceaf26-fd71-4c38-90f1-2de20b946d00',
  }),
});

export const COMPARISON_OPERATORS = ['lt', 'lte', 'gt', 'gte', 'eq', 'neq'] as const;
export const VALUE_TYPES = ['absolute', 'percent_change'] as const;
export const BASELINE_TYPES = ['relative'] as const;
export const COMPOUND_OPERATORS = ['and', 'or'] as const;
export const FIRE_WHEN = ['any', 'all'] as const;
export const FILTER_OPERATORS = ['eq', 'neq', 'in', 'not_in'] as const;

const DURATION = z
  .string()
  .regex(/^\d+(s|m|h|d|w)$/, 'Must be a duration such as "0m", "1h", or "1d".');

const Baseline = z.object({
  type: z.enum(BASELINE_TYPES, {
    error: `Invalid baseline type. Valid values are: ${BASELINE_TYPES.join(', ')}.`,
  }),
  period: DURATION.openapi({ example: '1w' }),
});

const SimpleCondition = z.object({
  operator: z
    .enum(COMPARISON_OPERATORS, {
      error: `Invalid operator. Valid values are: ${COMPARISON_OPERATORS.join(', ')}.`,
    })
    .openapi({ example: 'lt' }),
  value: z.number().openapi({ example: 5000 }),
  valueType: z
    .enum(VALUE_TYPES, {
      error: `Invalid value type. Valid values are: ${VALUE_TYPES.join(', ')}.`,
    })
    .openapi({ example: 'absolute' }),
  baseline: Baseline.nullish(),
});

const CompoundCondition = z.object({
  type: z.literal('compound'),
  operator: z.enum(COMPOUND_OPERATORS, {
    error: `Invalid operator. Valid values are: ${COMPOUND_OPERATORS.join(', ')}.`,
  }),
  conditions: z
    .array(SimpleCondition)
    .min(2, 'A compound condition must have at least two conditions.'),
});

const Condition = z.union([CompoundCondition, SimpleCondition]);

const Filter = z.object({
  field: z.string().min(1, 'The filter field must not be empty.').openapi({ example: 'user_type' }),
  operator: z
    .enum(FILTER_OPERATORS, {
      error: `Invalid filter operator. Valid values are: ${FILTER_OPERATORS.join(', ')}.`,
    })
    .openapi({ example: 'eq' }),
  value: z
    .union([z.string(), z.number(), z.boolean(), z.array(z.union([z.string(), z.number()]))])
    .openapi({ example: 'new_paid' }),
});

const Scope = z.object({
  splitBy: z.string().min(1, 'The splitBy field must not be empty.').nullish().openapi({
    example: 'user_type',
  }),
  fireWhen: z
    .enum(FIRE_WHEN, {
      error: `Invalid fireWhen. Valid values are: ${FIRE_WHEN.join(', ')}.`,
    })
    .nullish()
    .openapi({ example: 'any' }),
  filter: Filter.nullish(),
});

export const CreateMonitorRequest = z.object({
  name: z.string().min(1, 'The name must not be empty.').openapi({
    example: 'Daily revenue floor',
  }),
  description: z.string().nullish().openapi({
    example: 'Fires when daily revenue drops below the SLA floor.',
  }),
  metricId: z.uuid().openapi({
    description: 'The UUID of the metric this monitor watches.',
    example: 'a1b2c3d4-5678-90ab-cdef-1234567890ab',
  }),
  scope: Scope.nullish(),
  condition: Condition,
  window: DURATION.openapi({ example: '1d' }),
  holdFor: DURATION.openapi({ example: '0m' }),
  workflowId: z.string().min(1, 'The workflowId must not be empty.').nullish().openapi({
    example: 'wf_revenue_alert',
  }),
});

export const CreateMonitorResponse = z.object({
  monitorId: z.uuid(),
  name: z.string(),
  description: z.string().nullish(),
  metricId: z.uuid(),
  scope: Scope.nullish(),
  condition: Condition,
  window: z.string(),
  holdFor: z.string(),
  workflowId: z.string().nullish(),
  createdOn: z.iso.datetime(),
});
