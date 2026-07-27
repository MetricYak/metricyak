import { z } from '@hono/zod-openapi';
import { GRANULARITIES } from '@/modules/aggregates/engine/series.js';
import { EVENT_PAGE_SIZES } from '@/modules/events/events.schemas.js';

export const MetricParams = z.object({
  projectId: z.uuid().openapi({ param: { name: 'projectId', in: 'path' } }),
  metricId: z.uuid().openapi({ param: { name: 'metricId', in: 'path' } }),
});

export const FilterParam = z
  .union([z.string(), z.array(z.string())])
  .optional()
  .openapi({
    param: { name: 'filter', in: 'query' },
    description:
      'Repeatable dimension filter formatted `name:value`, split on the first colon. Each name must be a declared dimension of the metric.',
  });

export const ValueQuery = z.object({
  from: z.iso.datetime().openapi({ param: { name: 'from', in: 'query' } }),
  to: z.iso.datetime().openapi({ param: { name: 'to', in: 'query' } }),
  splitBy: z
    .string()
    .min(1)
    .optional()
    .openapi({ param: { name: 'splitBy', in: 'query' } }),
  filter: FilterParam,
});

export const ValueResponse = z.object({
  value: z.number().nullable(),
  breakdown: z.array(z.object({ dimValue: z.string(), value: z.number().nullable() })).optional(),
});

export const SeriesQuery = z.object({
  from: z.iso.datetime().openapi({ param: { name: 'from', in: 'query' } }),
  to: z.iso.datetime().openapi({ param: { name: 'to', in: 'query' } }),
  granularity: z.enum(GRANULARITIES).openapi({ param: { name: 'granularity', in: 'query' } }),
  splitBy: z
    .string()
    .min(1)
    .optional()
    .openapi({ param: { name: 'splitBy', in: 'query' } }),
  filter: FilterParam,
});

export const SeriesResponse = z.object({
  granularity: z.enum(GRANULARITIES),
  series: z.array(
    z.object({
      dimValue: z.string().nullable(),
      points: z.array(z.object({ start: z.iso.datetime(), value: z.number().nullable() })),
    }),
  ),
});

export const MetricEventsQuery = z.object({
  from: z.iso.datetime().openapi({ param: { name: 'from', in: 'query' } }),
  to: z.iso.datetime().openapi({ param: { name: 'to', in: 'query' } }),
  filter: FilterParam,
  sort: z
    .enum(['asc', 'desc'])
    .default('desc')
    .openapi({ param: { name: 'sort', in: 'query' } }),
  page: z.coerce
    .number()
    .int('The page must be an integer.')
    .min(0, 'The page must not be negative.')
    .default(0)
    .openapi({ param: { name: 'page', in: 'query' } }),
  pageSize: z.coerce
    .number()
    .int('The pageSize must be an integer.')
    .refine((value) => EVENT_PAGE_SIZES.includes(value), {
      error: `The pageSize must be one of: ${EVENT_PAGE_SIZES.join(', ')}.`,
    })
    .default(25)
    .openapi({ param: { name: 'pageSize', in: 'query' } }),
});
