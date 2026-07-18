import { createRoute } from '@hono/zod-openapi';
import { errorResponse } from '@/http/errors.js';
import { respond } from '@/http/respond.js';
import { createRouter } from '@/http/router.js';
import { orNotFound } from '@/http/scope.js';
import {
  MetricParams,
  ValueQuery,
  ValueResponse,
} from '@/modules/aggregates/aggregates.schemas.js';

const valueRoute = createRoute({
  method: 'get',
  path: '/projects/{projectId}/metrics/{metricId}/value',
  request: { params: MetricParams, query: ValueQuery },
  responses: {
    200: {
      content: { 'application/json': { schema: ValueResponse } },
      description: 'The metric value over a window.',
    },
    404: errorResponse('The metric could not be found.'),
  },
});

const router = createRouter();

router.openapi(valueRoute, async (c) => {
  const { projectId, metricId } = c.req.valid('param');
  const { from, to, splitBy } = c.req.valid('query');
  const { reads, repos } = c.var.container;

  const metric = orNotFound(
    await repos.metrics.getDefinition(metricId, projectId),
    'The metric could not be found.',
  );

  const result = await reads.value(
    metric,
    projectId,
    { from: new Date(from), to: new Date(to) },
    splitBy,
  );

  return respond(c, ValueResponse, result, 200);
});

export default router;
