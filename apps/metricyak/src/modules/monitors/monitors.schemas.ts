import { z } from '@hono/zod-openapi';
import {
  type MetricDefinition,
  MONITOR_COMPARISON_OPERATORS,
  MONITOR_EVAL_HEALTHS,
  MONITOR_MISSING_DATA,
  MONITOR_STATUSES,
  type MonitorComparisonOperator,
  type MonitorRecord,
  type MonitorTotalState,
} from '@metricyak/storage';

const ProjectIdParam = z.uuid().openapi({
  param: { name: 'projectId', in: 'path' },
  example: 'd6ceaf26-fd71-4c38-90f1-2de20b946d00',
});

const MonitorIdParam = z.uuid().openapi({
  param: { name: 'monitorId', in: 'path' },
  example: 'a1b2c3d4-5678-90ab-cdef-1234567890ab',
});

export const ProjectScopedParams = z.object({ projectId: ProjectIdParam });

export const MonitorScopedParams = z.object({
  projectId: ProjectIdParam,
  monitorId: MonitorIdParam,
});

export const FIRE_WHEN = ['any', 'all'] as const;
export const FILTER_OPERATORS = ['eq', 'neq', 'in', 'not_in'] as const;

const DURATION = z
  .string()
  .regex(/^\d+(s|m|h|d|w)$/, 'Must be a duration such as "0m", "1h", or "1d".');

const Condition = z.object({
  operator: z
    .enum(MONITOR_COMPARISON_OPERATORS, {
      error: `Invalid operator. Valid values are: ${MONITOR_COMPARISON_OPERATORS.join(', ')}.`,
    })
    .openapi({ example: 'lt' }),
  value: z.number().openapi({ example: 5000 }),
});

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

const MissingData = z
  .enum(MONITOR_MISSING_DATA, {
    error: `Invalid missingData. Valid values are: ${MONITOR_MISSING_DATA.join(', ')}.`,
  })
  .openapi({ example: 'skip' });

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
  enabled: z.boolean().default(true).openapi({ example: true }),
  missingData: MissingData.default('skip'),
});

export const UpdateMonitorRequest = z.object({
  name: z.string().min(1, 'The name must not be empty.').optional(),
  description: z.string().nullish(),
  metricId: z.uuid().optional(),
  scope: Scope.nullish(),
  condition: Condition.optional(),
  window: DURATION.optional(),
  holdFor: DURATION.optional(),
  enabled: z.boolean().optional(),
  missingData: MissingData.optional(),
});

export const MonitorResponse = z.object({
  monitorId: z.uuid(),
  name: z.string(),
  description: z.string().nullish(),
  metricId: z.uuid(),
  scope: Scope.nullish(),
  condition: Condition,
  window: z.string(),
  holdFor: z.string(),
  enabled: z.boolean(),
  missingData: MissingData,
  evalHealth: z.enum(MONITOR_EVAL_HEALTHS),
  lastEvalError: z.string().nullish(),
  lastEvalErrorAt: z.iso.datetime().nullish(),
  lastEvaluatedAt: z.iso.datetime().nullish(),
  status: z.enum(MONITOR_STATUSES).nullable(),
  lastValue: z.number().nullable(),
  createdOn: z.iso.datetime(),
  updatedOn: z.iso.datetime(),
});

export const ListMonitorsQuery = z.object({
  page: z.coerce
    .number()
    .int('The page must be an integer.')
    .min(0, 'The page must not be negative.')
    .default(0)
    .openapi({ param: { name: 'page', in: 'query' } }),
  pageSize: z.coerce
    .number()
    .int('The pageSize must be an integer.')
    .min(1, 'The pageSize must be at least 1.')
    .max(100, 'The pageSize must be at most 100.')
    .default(20)
    .openapi({ param: { name: 'pageSize', in: 'query' } }),
});

export const ListMonitorsResponse = z.object({
  monitors: z.array(MonitorResponse),
  hasMore: z.boolean(),
});

export const DeleteMonitorResponse = z.object({ deleted: z.literal(true) });

export function toMonitorResponse(
  record: MonitorRecord,
  state: MonitorTotalState | null,
): z.input<typeof MonitorResponse> {
  return {
    monitorId: record.id,
    name: record.name,
    description: record.description,
    metricId: record.metricId,
    scope: record.scope,
    condition: record.condition,
    window: record.window,
    holdFor: record.holdFor,
    enabled: record.enabled,
    missingData: record.missingData,
    evalHealth: record.evalHealth,
    lastEvalError: record.lastEvalError,
    lastEvalErrorAt: record.lastEvalErrorAt?.toISOString() ?? null,
    lastEvaluatedAt: state?.lastEvaluatedAt?.toISOString() ?? null,
    status: state?.status ?? null,
    lastValue: state?.lastValue ?? null,
    createdOn: record.createdAt.toISOString(),
    updatedOn: record.updatedAt.toISOString(),
  };
}

export function isEqualityOperator(operator: MonitorComparisonOperator): boolean {
  return operator === 'eq' || operator === 'neq';
}

function valueExpressionCanDivide(expression: string): boolean {
  return expression.includes('/');
}

export function metricYieldsIntegerValues(definition: MetricDefinition): boolean {
  const everyEventIsACount = definition.events.every((event) => event.aggregation === 'count');
  if (!everyEventIsACount) return false;
  return definition.value == null || !valueExpressionCanDivide(definition.value);
}
