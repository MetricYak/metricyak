import { createRoute } from '@hono/zod-openapi';
import { TOTAL_SENTINEL } from '@metricyak/storage';
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
import { fieldPath } from './engine/ingest.js';
import { aggregateScalar, windowValues } from './engine/materialize.js';

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
  const { aggregates, repositories } = c.var.container;

  const metric = await repositories.metrics.getDefinition(metricId, projectId);
  if (!metric) throw new NotFoundError('The metric could not be found');

  const partials = await aggregates.getPartials({
    metricId,
    metricVersion: metric.version,
    granularity: 'minute',
    rangeStart: new Date(from),
    rangeEnd: new Date(to),
  });

  const values = windowValues(metric.definition, partials);
  const total = values.find((v) => v.dimName === TOTAL_SENTINEL)?.value ?? null;
  const breakdown = splitBy
    ? values
        .filter((v) => v.dimName === splitBy)
        .map((v) => ({ dimValue: v.dimValue, value: v.value }))
    : undefined;

  return c.json(ValueResponse.parse({ value: total, breakdown }), 200);
});

router.openapi(breakdownRoute, async (c) => {
  const { projectId, metricId } = c.req.valid('param');
  const { from, to, compareFrom, compareTo, dimension, limit } = c.req.valid('query');
  const { aggregates, repositories } = c.var.container;

  const metric = await repositories.metrics.getDefinition(metricId, projectId);
  if (!metric) throw new NotFoundError('The metric could not be found');

  const declared = metric.definition.dimensions?.includes(dimension) ?? false;
  const current = new Map<string, number | null>();
  const previous = new Map<string, number | null>();

  if (declared) {
    const collect = async (rangeStart: Date, rangeEnd: Date, into: Map<string, number | null>) => {
      const partials = await aggregates.getPartials({
        metricId,
        metricVersion: metric.version,
        granularity: 'minute',
        rangeStart,
        rangeEnd,
      });
      for (const value of windowValues(metric.definition, partials)) {
        if (value.dimName === dimension) into.set(value.dimValue, value.value);
      }
    };
    await collect(new Date(from), new Date(to), current);
    await collect(new Date(compareFrom), new Date(compareTo), previous);
  } else {
    const [event, ...rest] = metric.definition.events;
    if (!event || rest.length > 0) {
      throw new AppError(422, [
        errorItem(
          ERROR_TYPES.validation,
          'unsupported',
          'On-demand breakdown of an undeclared dimension is only supported for single-event metrics.',
          'dimension',
        ),
      ]);
    }
    const eventNames = metric.definition.events.map((e) => e.type);
    const collect = async (rangeStart: Date, rangeEnd: Date, into: Map<string, number | null>) => {
      const rows = await aggregates.rawBreakdown({
        projectId,
        eventNames,
        dimField: dimension,
        valuePath: event.field ? fieldPath(event.field) : null,
        from: rangeStart,
        to: rangeEnd,
      });
      for (const row of rows) into.set(row.dimValue, aggregateScalar(event.aggregation, row));
    };
    await collect(new Date(from), new Date(to), current);
    await collect(new Date(compareFrom), new Date(compareTo), previous);
  }

  const dimValues = new Set([...current.keys(), ...previous.keys()]);
  const rows = [...dimValues].map((dimValue) => {
    const cur = current.get(dimValue) ?? null;
    const prev = previous.get(dimValue) ?? null;
    return { dimValue, current: cur, previous: prev, delta: (cur ?? 0) - (prev ?? 0) };
  });

  const totalDelta = rows.reduce((sum, row) => sum + row.delta, 0);
  const movers = rows
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
    .slice(0, limit)
    .map((row) => ({
      ...row,
      contribution: totalDelta === 0 ? null : row.delta / totalDelta,
    }));

  return c.json(BreakdownResponse.parse({ movers }), 200);
});

export default router;
