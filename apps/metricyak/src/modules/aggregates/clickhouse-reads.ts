import type { ClickHouseClient } from '@metricyak/clickhouse';
import { type MetricSummary, OTHER_SENTINEL, TOTAL_SENTINEL } from '@metricyak/storage';
import type {
  DimensionFilter,
  ReadsAggregates,
  Window,
} from '@/modules/aggregates/aggregates.reads.js';
import { fieldPath } from '@/modules/aggregates/engine/ingest.js';
import type { Granularity } from '@/modules/aggregates/engine/series.js';
import type { PartialRow } from '@/modules/aggregates/types.js';

/** Splits a dot-separated JSON path into quoted, comma-joined ClickHouse JSON-function arguments. */
function jsonPathArgs(path: readonly string[]): string {
  return path.map((seg) => `'${seg.replace(/'/g, "\\'")}'`).join(', ');
}

/** JSON accessor for a value path over the `properties` String column, as Nullable(Float64). */
function numericExpr(valuePath: readonly string[] | null): string {
  if (!valuePath || valuePath.length === 0) return 'CAST(NULL AS Nullable(Float64))';
  return `JSONExtract(properties, ${jsonPathArgs(valuePath)}, 'Nullable(Float64)')`;
}

/**
 * JSON accessor for a (possibly dot-nested) dimension name over `properties`, e.g. "geo.country"
 * resolves properties.geo.country rather than a literal top-level key named "geo.country".
 */
function dimExpr(dim: string): { has: string; extract: string } {
  const args = jsonPathArgs(dim.split('.'));
  return {
    has: `JSONHas(properties, ${args})`,
    extract: `JSONExtractString(properties, ${args})`,
  };
}

/**
 * Formats a Date for a ClickHouse `DateTime64(3, 'UTC')` query param. ClickHouse's parameter
 * parser rejects ISO 8601's `T` separator and `Z` suffix — it wants `YYYY-MM-DD HH:MM:SS.sss`.
 * `toISOString()` always normalizes to UTC with a literal `Z` (never a `+HH:MM` offset), so a
 * single non-global `.replace()` of each is safe for any Date.
 */
function chDateTime(date: Date): string {
  return date.toISOString().replace('T', ' ').replace('Z', '');
}

/**
 * ClickHouse's DateTime64(3, 'UTC') JSONEachRow output is `YYYY-MM-DD HH:MM:SS.sss`
 * (space-separated, no zone suffix). Node's `Date` constructor treats that shape as
 * local time, not UTC, so the separator and zone must be restored explicitly.
 */
function chTimestampToDate(raw: string): Date {
  return new Date(`${raw.replace(' ', 'T')}Z`);
}

/**
 * `toStartOfInterval` requires a literal INTERVAL — ClickHouse will not accept it as a
 * bound query parameter. Interpolating from this table is safe because the key is the
 * closed `Granularity` enum, never caller-supplied text.
 */
const CH_INTERVAL: Readonly<Record<Granularity, string>> = {
  '1m': '1 MINUTE',
  '5m': '5 MINUTE',
  '15m': '15 MINUTE',
  '1h': '1 HOUR',
  '4h': '4 HOUR',
  '1d': '1 DAY',
};

function filterPredicates(filters: readonly DimensionFilter[]): {
  conditions: string[];
  params: Record<string, string>;
} {
  const conditions: string[] = [];
  const params: Record<string, string> = {};
  filters.forEach((filter, index) => {
    const key = `filterValue${index}`;
    conditions.push(`${dimExpr(filter.name).extract} = {${key}:String}`);
    params[key] = filter.value;
  });
  return { conditions, params };
}

async function eventPartials(
  client: ClickHouseClient,
  projectId: string,
  window: Window,
  event: { key: string; type: string; field?: string | null },
  dimensions: readonly string[],
  filters: readonly DimensionFilter[],
): Promise<PartialRow[]> {
  const val = numericExpr(event.field ? fieldPath(event.field) : null);
  const predicates = filterPredicates(filters);
  const baseParams = {
    projectId,
    name: event.type,
    from: chDateTime(window.from),
    to: chDateTime(window.to),
    ...predicates.params,
  };
  const where = [
    'project_id = {projectId:UUID}',
    'name = {name:String}',
    `timestamp >= {from:DateTime64(3, 'UTC')}`,
    `timestamp < {to:DateTime64(3, 'UTC')}`,
    ...predicates.conditions,
  ].join(' AND ');

  const totalRs = await client.query({
    query: `SELECT toInt64(count()) AS count, toFloat64(sum(${val})) AS sum, min(${val}) AS min, max(${val}) AS max FROM events FINAL WHERE ${where}`,
    query_params: baseParams,
    format: 'JSONEachRow',
  });
  const [t] = await totalRs.json<{
    count: string;
    sum: number;
    min: number | null;
    max: number | null;
  }>();
  const rows: PartialRow[] = [
    {
      bucketStart: window.from,
      seriesKey: event.key,
      dimName: TOTAL_SENTINEL,
      dimValue: TOTAL_SENTINEL,
      count: Number(t?.count ?? 0),
      sum: Number(t?.sum ?? 0),
      min: t?.min ?? null,
      max: t?.max ?? null,
    },
  ];

  for (const dim of dimensions) {
    const { has, extract } = dimExpr(dim);
    const rs = await client.query({
      query: `
        SELECT if(${has}, ${extract}, {other:String}) AS dimValue,
               toInt64(count()) AS count, toFloat64(sum(${val})) AS sum, min(${val}) AS min, max(${val}) AS max
        FROM events FINAL WHERE ${where} GROUP BY dimValue`,
      query_params: { ...baseParams, other: OTHER_SENTINEL },
      format: 'JSONEachRow',
    });
    for (const r of await rs.json<{
      dimValue: string;
      count: string;
      sum: number;
      min: number | null;
      max: number | null;
    }>()) {
      rows.push({
        bucketStart: window.from,
        seriesKey: event.key,
        dimName: dim,
        dimValue: r.dimValue,
        count: Number(r.count),
        sum: Number(r.sum),
        min: r.min,
        max: r.max,
      });
    }
  }
  return rows;
}

export async function chWindowPartials(
  client: ClickHouseClient,
  params: {
    metric: MetricSummary;
    projectId: string;
    window: Window;
    filters: readonly DimensionFilter[];
  },
): Promise<PartialRow[]> {
  const { metric, projectId, window, filters } = params;
  const dims = metric.definition.dimensions ?? [];
  const all = await Promise.all(
    metric.definition.events.map((e) => eventPartials(client, projectId, window, e, dims, filters)),
  );
  return all.flat();
}

type BucketEventPartialsParams = {
  projectId: string;
  window: Window;
  granularity: Granularity;
  filters: readonly DimensionFilter[];
  event: { key: string; type: string; field?: string | null };
  dimensions: readonly string[];
};

async function bucketEventPartials(
  client: ClickHouseClient,
  params: BucketEventPartialsParams,
): Promise<PartialRow[]> {
  const { projectId, window, granularity, filters, event, dimensions } = params;
  const val = numericExpr(event.field ? fieldPath(event.field) : null);
  const bucketExpr = `toStartOfInterval(timestamp, INTERVAL ${CH_INTERVAL[granularity]})`;
  const predicates = filterPredicates(filters);
  const baseParams = {
    projectId,
    name: event.type,
    from: chDateTime(window.from),
    to: chDateTime(window.to),
    ...predicates.params,
  };
  const where = [
    'project_id = {projectId:UUID}',
    'name = {name:String}',
    `timestamp >= {from:DateTime64(3, 'UTC')}`,
    `timestamp < {to:DateTime64(3, 'UTC')}`,
    ...predicates.conditions,
  ].join(' AND ');
  const measures = `toInt64(count()) AS count, toFloat64(sum(${val})) AS sum, min(${val}) AS min, max(${val}) AS max`;

  const totalRs = await client.query({
    query: `
      SELECT ${bucketExpr} AS bucketStart, ${measures}
      FROM events FINAL WHERE ${where} GROUP BY bucketStart`,
    query_params: baseParams,
    format: 'JSONEachRow',
  });
  const rows: PartialRow[] = (
    await totalRs.json<{
      bucketStart: string;
      count: string;
      sum: number;
      min: number | null;
      max: number | null;
    }>()
  ).map((r) => ({
    bucketStart: chTimestampToDate(r.bucketStart),
    seriesKey: event.key,
    dimName: TOTAL_SENTINEL,
    dimValue: TOTAL_SENTINEL,
    count: Number(r.count),
    sum: Number(r.sum),
    min: r.min,
    max: r.max,
  }));

  for (const dim of dimensions) {
    const { has, extract } = dimExpr(dim);
    const rs = await client.query({
      query: `
        SELECT ${bucketExpr} AS bucketStart,
               if(${has}, ${extract}, {other:String}) AS dimValue, ${measures}
        FROM events FINAL WHERE ${where} GROUP BY bucketStart, dimValue`,
      query_params: { ...baseParams, other: OTHER_SENTINEL },
      format: 'JSONEachRow',
    });
    for (const r of await rs.json<{
      bucketStart: string;
      dimValue: string;
      count: string;
      sum: number;
      min: number | null;
      max: number | null;
    }>()) {
      rows.push({
        bucketStart: chTimestampToDate(r.bucketStart),
        seriesKey: event.key,
        dimName: dim,
        dimValue: r.dimValue,
        count: Number(r.count),
        sum: Number(r.sum),
        min: r.min,
        max: r.max,
      });
    }
  }
  return rows;
}

export async function chBucketPartials(
  client: ClickHouseClient,
  params: {
    metric: MetricSummary;
    projectId: string;
    window: Window;
    granularity: Granularity;
    filters: readonly DimensionFilter[];
  },
): Promise<PartialRow[]> {
  const { metric, projectId, window, granularity, filters } = params;
  const dimensions = metric.definition.dimensions ?? [];
  const all = await Promise.all(
    metric.definition.events.map((event) =>
      bucketEventPartials(client, { projectId, window, granularity, filters, event, dimensions }),
    ),
  );
  return all.flat();
}

export function createClickHouseReadsAggregates(client: ClickHouseClient): ReadsAggregates {
  return {
    windowPartials: (params) => chWindowPartials(client, params),
    bucketPartials: (params) => chBucketPartials(client, params),
  };
}
