import type { ClickHouseClient } from '@metricyak/clickhouse';
import { type MetricSummary, OTHER_SENTINEL, type PartialRow, type RawBreakdownRow, TOTAL_SENTINEL } from '@metricyak/storage';
import { fieldPath } from '@/modules/aggregates/engine/ingest.js';
import type { ReadsAggregates, Window } from '@/modules/aggregates/aggregates.reads.js';

/** JSON accessor for a value path over the `properties` String column, as Nullable(Float64). */
function numericExpr(valuePath: readonly string[] | null): string {
  if (!valuePath || valuePath.length === 0) return 'CAST(NULL AS Nullable(Float64))';
  const args = valuePath.map((seg) => `'${seg.replace(/'/g, "\\'")}'`).join(', ');
  return `JSONExtract(properties, ${args}, 'Nullable(Float64)')`;
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

export async function chRawBreakdown(
  client: ClickHouseClient,
  params: {
    projectId: string;
    eventNames: readonly string[];
    dimField: string;
    valuePath: readonly string[] | null;
    from: Date;
    to: Date;
  },
): Promise<RawBreakdownRow[]> {
  const val = numericExpr(params.valuePath);
  const fromStr = chDateTime(params.from);
  const toStr = chDateTime(params.to);

  const rs = await client.query({
    query: `
      SELECT
        if(JSONHas(properties, {dim:String}), JSONExtractString(properties, {dim:String}), {other:String}) AS dimValue,
        toInt64(count()) AS count,
        toFloat64(sum(${val})) AS sum,
        min(${val}) AS min,
        max(${val}) AS max
      FROM events
      WHERE project_id = {projectId:UUID}
        AND name IN {names:Array(String)}
        AND timestamp >= {from:DateTime64(3, 'UTC')}
        AND timestamp <  {to:DateTime64(3, 'UTC')}
      GROUP BY dimValue
    `,
    query_params: {
      dim: params.dimField,
      other: OTHER_SENTINEL,
      projectId: params.projectId,
      names: [...params.eventNames],
      from: fromStr,
      to: toStr,
    },
    format: 'JSONEachRow',
  });
  const raw = await rs.json<{ dimValue: string; count: string; sum: number; min: number | null; max: number | null }>();
  return raw.map((r) => ({
    dimValue: r.dimValue,
    count: Number(r.count),
    sum: Number(r.sum),
    min: r.min,
    max: r.max,
  }));
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
    query: `SELECT toInt64(count()) AS count, toFloat64(sum(${val})) AS sum, min(${val}) AS min, max(${val}) AS max FROM events WHERE ${where}`,
    query_params: baseParams,
    format: 'JSONEachRow',
  });
  const [t] = await totalRs.json<{ count: string; sum: number; min: number | null; max: number | null }>();
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
    const rs = await client.query({
      query: `
        SELECT if(JSONHas(properties, {dim:String}), JSONExtractString(properties, {dim:String}), {other:String}) AS dimValue,
               toInt64(count()) AS count, toFloat64(sum(${val})) AS sum, min(${val}) AS min, max(${val}) AS max
        FROM events WHERE ${where} GROUP BY dimValue`,
      query_params: { ...baseParams, dim, other: OTHER_SENTINEL },
      format: 'JSONEachRow',
    });
    for (const r of await rs.json<{ dimValue: string; count: string; sum: number; min: number | null; max: number | null }>()) {
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
    rawBreakdown: (params) => chRawBreakdown(client, params),
  };
}
