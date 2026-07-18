import type { ClickHouseClient } from '@metricyak/clickhouse';
import { type MetricSummary, OTHER_SENTINEL, TOTAL_SENTINEL } from '@metricyak/storage';
import type { ReadsAggregates, Window } from '@/modules/aggregates/aggregates.reads.js';
import { fieldPath } from '@/modules/aggregates/engine/ingest.js';
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

async function eventPartials(
  client: ClickHouseClient,
  projectId: string,
  window: Window,
  event: { key: string; type: string; field?: string | null },
  dimensions: readonly string[],
): Promise<PartialRow[]> {
  const val = numericExpr(event.field ? fieldPath(event.field) : null);
  const baseParams = {
    projectId,
    name: event.type,
    from: chDateTime(window.from),
    to: chDateTime(window.to),
  };
  const where = `
    project_id = {projectId:UUID} AND name = {name:String}
    AND timestamp >= {from:DateTime64(3, 'UTC')} AND timestamp < {to:DateTime64(3, 'UTC')}`;

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
  params: { metric: MetricSummary; projectId: string; window: Window },
): Promise<PartialRow[]> {
  const { metric, projectId, window } = params;
  const dims = metric.definition.dimensions ?? [];
  const all = await Promise.all(
    metric.definition.events.map((e) => eventPartials(client, projectId, window, e, dims)),
  );
  return all.flat();
}

export function createClickHouseReadsAggregates(client: ClickHouseClient): ReadsAggregates {
  return {
    windowPartials: (params) => chWindowPartials(client, params),
  };
}
