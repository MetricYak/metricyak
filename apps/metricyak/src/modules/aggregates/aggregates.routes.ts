import { createRoute } from '@hono/zod-openapi';
import type { MetricDefinition } from '@metricyak/storage';
import { ERROR_TYPES, errorItem, errorResponse, ValidationError } from '@/http/errors.js';
import { respond } from '@/http/respond.js';
import { createRouter } from '@/http/router.js';
import { orNotFound } from '@/http/scope.js';
import { type DimensionFilter, MAX_CHART_SERIES } from '@/modules/aggregates/aggregates.reads.js';
import {
  MetricEventsQuery,
  MetricParams,
  SeriesQuery,
  SeriesResponse,
  ValueQuery,
  ValueResponse,
} from '@/modules/aggregates/aggregates.schemas.js';
import {
  bucketCountFor,
  type Granularity,
  MAX_SERIES_BUCKETS,
} from '@/modules/aggregates/engine/series.js';
import { ListEventsResponse } from '@/modules/events/events.schemas.js';

export function parseFilters(raw: string | string[] | undefined): DimensionFilter[] {
  if (raw === undefined) return [];
  const entries = Array.isArray(raw) ? raw : [raw];
  return entries.map((entry) => {
    const separator = entry.indexOf(':');
    if (separator <= 0 || separator === entry.length - 1) {
      throw new ValidationError([
        errorItem(
          ERROR_TYPES.validation,
          'invalid_filter',
          `The filter "${entry}" must be formatted name:value.`,
          'filter',
        ),
      ]);
    }
    return { name: entry.slice(0, separator), value: entry.slice(separator + 1) };
  });
}

function assertDeclaredDimensions(
  definition: MetricDefinition,
  names: readonly { name: string; attribute: string }[],
): void {
  const declared = new Set(definition.dimensions ?? []);
  for (const { name, attribute } of names) {
    if (!declared.has(name)) {
      throw new ValidationError([
        errorItem(
          ERROR_TYPES.validation,
          'undeclared_dimension',
          `"${name}" is not a dimension of this metric.`,
          attribute,
        ),
      ]);
    }
  }
}

function assertChartableWindow(from: Date, to: Date, granularity: Granularity): void {
  if (to.getTime() <= from.getTime()) {
    throw new ValidationError([
      errorItem(
        ERROR_TYPES.validation,
        'empty_window',
        'The "to" time must be after the "from" time.',
        'to',
      ),
    ]);
  }

  const buckets = bucketCountFor(from, to, granularity);
  if (buckets > MAX_SERIES_BUCKETS) {
    throw new ValidationError([
      errorItem(
        ERROR_TYPES.validation,
        'granularity_too_fine',
        `A ${granularity} granularity over this window needs ${buckets} buckets, above the limit of ${MAX_SERIES_BUCKETS}. Use a coarser granularity or a shorter window.`,
        'granularity',
      ),
    ]);
  }
}

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

const seriesRoute = createRoute({
  method: 'get',
  path: '/projects/{projectId}/metrics/{metricId}/series',
  request: { params: MetricParams, query: SeriesQuery },
  responses: {
    200: {
      content: { 'application/json': { schema: SeriesResponse } },
      description: 'The metric charted over time, one point per granularity bucket.',
    },
    400: errorResponse('The request failed validation.'),
    404: errorResponse('The metric could not be found.'),
  },
});

const metricEventsRoute = createRoute({
  method: 'get',
  path: '/projects/{projectId}/metrics/{metricId}/events',
  request: { params: MetricParams, query: MetricEventsQuery },
  responses: {
    200: {
      content: { 'application/json': { schema: ListEventsResponse } },
      description: 'A page of the raw events the metric is built from.',
    },
    400: errorResponse('The request failed validation.'),
    404: errorResponse('The metric could not be found.'),
  },
});

const router = createRouter();

router.openapi(valueRoute, async (c) => {
  const { projectId, metricId } = c.req.valid('param');
  const { from, to, splitBy, filter } = c.req.valid('query');
  const { reads, repos } = c.var.container;

  const metric = orNotFound(
    await repos.metrics.getDefinition(metricId, projectId),
    'The metric could not be found.',
  );

  const filters = parseFilters(filter);
  assertDeclaredDimensions(metric.definition, [
    ...filters.map((entry) => ({ name: entry.name, attribute: 'filter' })),
    ...(splitBy ? [{ name: splitBy, attribute: 'splitBy' }] : []),
  ]);

  const result = await reads.value(
    metric,
    projectId,
    { from: new Date(from), to: new Date(to) },
    { splitBy, filters },
  );

  return respond(c, ValueResponse, result, 200);
});

router.openapi(seriesRoute, async (c) => {
  const { projectId, metricId } = c.req.valid('param');
  const { from, to, granularity, splitBy, filter } = c.req.valid('query');
  const { reads, repos } = c.var.container;

  const metric = orNotFound(
    await repos.metrics.getDefinition(metricId, projectId),
    'The metric could not be found.',
  );

  const filters = parseFilters(filter);
  assertDeclaredDimensions(metric.definition, [
    ...filters.map((entry) => ({ name: entry.name, attribute: 'filter' })),
    ...(splitBy ? [{ name: splitBy, attribute: 'splitBy' }] : []),
  ]);

  const window = { from: new Date(from), to: new Date(to) };
  assertChartableWindow(window.from, window.to, granularity);

  const series = await reads.series(metric, projectId, window, {
    granularity,
    splitBy,
    filters,
    maxSeries: MAX_CHART_SERIES,
  });

  return respond(
    c,
    SeriesResponse,
    {
      granularity,
      series: series.map((entry) => ({
        dimValue: entry.dimValue,
        points: entry.points.map((point) => ({
          start: point.start.toISOString(),
          value: point.value,
        })),
      })),
    },
    200,
  );
});

router.openapi(metricEventsRoute, async (c) => {
  const { projectId, metricId } = c.req.valid('param');
  const { from, to, filter, sort, page, pageSize } = c.req.valid('query');
  const { eventsReads, repos } = c.var.container;

  const metric = orNotFound(
    await repos.metrics.getDefinition(metricId, projectId),
    'The metric could not be found.',
  );

  const filters = parseFilters(filter);
  assertDeclaredDimensions(
    metric.definition,
    filters.map((entry) => ({ name: entry.name, attribute: 'filter' })),
  );

  const result = await eventsReads.listPage({
    projectId,
    from: new Date(from),
    to: new Date(to),
    sort,
    page,
    pageSize,
    names: metric.definition.events.map((event) => event.type),
    propertyEquals: filters.map((entry) => ({ path: entry.name, value: entry.value })),
  });

  return respond(c, ListEventsResponse, result, 200);
});

export default router;
