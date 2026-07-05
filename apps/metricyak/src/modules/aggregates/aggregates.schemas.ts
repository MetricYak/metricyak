import { z } from '@hono/zod-openapi';
import { BUCKET_GRANULARITIES } from '@metricyak/storage';

export const MetricParams = z.object({
  projectId: z.uuid().openapi({ param: { name: 'projectId', in: 'path' } }),
  metricId: z.uuid().openapi({ param: { name: 'metricId', in: 'path' } }),
});

export const TimeseriesQuery = z.object({
  from: z.iso.datetime().openapi({ param: { name: 'from', in: 'query' } }),
  to: z.iso.datetime().openapi({ param: { name: 'to', in: 'query' } }),
  granularity: z
    .enum(BUCKET_GRANULARITIES)
    .default('hour')
    .openapi({ param: { name: 'granularity', in: 'query' } }),
  splitBy: z
    .string()
    .min(1)
    .optional()
    .openapi({ param: { name: 'splitBy', in: 'query' } }),
});

export const TimeseriesResponse = z.object({
  series: z.array(
    z.object({
      dimValue: z.string(),
      points: z.array(z.object({ bucketStart: z.iso.datetime(), value: z.number().nullable() })),
    }),
  ),
});

export const ValueQuery = z.object({
  from: z.iso.datetime().openapi({ param: { name: 'from', in: 'query' } }),
  to: z.iso.datetime().openapi({ param: { name: 'to', in: 'query' } }),
  splitBy: z
    .string()
    .min(1)
    .optional()
    .openapi({ param: { name: 'splitBy', in: 'query' } }),
});

export const ValueResponse = z.object({
  value: z.number().nullable(),
  breakdown: z.array(z.object({ dimValue: z.string(), value: z.number().nullable() })).optional(),
});

export const BreakdownQuery = z.object({
  from: z.iso.datetime().openapi({ param: { name: 'from', in: 'query' } }),
  to: z.iso.datetime().openapi({ param: { name: 'to', in: 'query' } }),
  compareFrom: z.iso.datetime().openapi({ param: { name: 'compareFrom', in: 'query' } }),
  compareTo: z.iso.datetime().openapi({ param: { name: 'compareTo', in: 'query' } }),
  dimension: z
    .string()
    .min(1)
    .openapi({ param: { name: 'dimension', in: 'query' } }),
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(100)
    .default(20)
    .openapi({
      param: { name: 'limit', in: 'query' },
    }),
});

export const BreakdownResponse = z.object({
  movers: z.array(
    z.object({
      dimValue: z.string(),
      current: z.number().nullable(),
      previous: z.number().nullable(),
      delta: z.number(),
      contribution: z.number().nullable(),
    }),
  ),
});
