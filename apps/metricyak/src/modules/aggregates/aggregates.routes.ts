import { createRoute } from '@hono/zod-openapi';
import {
  AppError,
  ERROR_TYPES,
  errorItem,
  errorResponse,
  NotFoundError,
} from '../../http/errors.js';
import { createRouter } from '../../http/router.js';
import {
  BreakdownQuery,
  BreakdownResponse,
  MetricParams,
  ValueQuery,
  ValueResponse,
} from './aggregates.schemas.js';

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

const breakdownRoute = createRoute({
  method: 'get',
  path: '/projects/{projectId}/metrics/{metricId}/breakdown',
  request: { params: MetricParams, query: BreakdownQuery },
  responses: {
    200: {
      content: { 'application/json': { schema: BreakdownResponse } },
      description: 'Per-dimension-value movers between two windows.',
    },
    404: errorResponse('The metric could not be found.'),
    422: errorResponse('The breakdown could not be computed for this dimension.'),
  },
});

const router = createRouter();

router.openapi(valueRoute, async (c) => {
  const { projectId, metricId } = c.req.valid('param');
  const { from, to, splitBy } = c.req.valid('query');
  const { reads, repos } = c.var.container;

  const metric = await repos.metrics.getDefinition(metricId, projectId);
  if (!metric) throw new NotFoundError('The metric could not be found');

  const result = await reads.value(
    metric,
    projectId,
    { from: new Date(from), to: new Date(to) },
    splitBy,
  );

  return c.json(ValueResponse.parse(result), 200);
});

router.openapi(breakdownRoute, async (c) => {
  const { projectId, metricId } = c.req.valid('param');
  const { from, to, compareFrom, compareTo, dimension, limit } = c.req.valid('query');
  const { reads, repos } = c.var.container;

  const metric = await repos.metrics.getDefinition(metricId, projectId);
  if (!metric) throw new NotFoundError('The metric could not be found');

  const result = await reads.breakdown(
    metric,
    projectId,
    {
      current: { from: new Date(from), to: new Date(to) },
      compare: { from: new Date(compareFrom), to: new Date(compareTo) },
    },
    dimension,
    limit,
  );

  if (result.kind === 'unsupported-dimension') {
    throw new AppError(422, [
      errorItem(
        ERROR_TYPES.validation,
        'unsupported',
        'On-demand breakdown of an undeclared dimension is only supported for single-event metrics.',
        'dimension',
      ),
    ]);
  }

  return c.json(BreakdownResponse.parse({ movers: result.movers }), 200);
});

export default router;
