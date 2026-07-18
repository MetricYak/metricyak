import { z } from '@hono/zod-openapi';

export const MetricParams = z.object({
  projectId: z.uuid().openapi({ param: { name: 'projectId', in: 'path' } }),
  metricId: z.uuid().openapi({ param: { name: 'metricId', in: 'path' } }),
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
