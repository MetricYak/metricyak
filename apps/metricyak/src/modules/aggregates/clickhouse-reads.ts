import type { ClickHouseClient } from '@metricyak/clickhouse';
import { OTHER_SENTINEL, type RawBreakdownRow } from '@metricyak/storage';

/** JSON accessor for a value path over the `properties` String column, as Nullable(Float64). */
function numericExpr(valuePath: readonly string[] | null): string {
  if (!valuePath || valuePath.length === 0) return 'CAST(NULL AS Nullable(Float64))';
  const args = valuePath.map((seg) => `'${seg.replace(/'/g, "\\'")}'`).join(', ');
  return `JSONExtract(properties, ${args}, 'Nullable(Float64)')`;
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
  // Format dates for ClickHouse DateTime64(3, 'UTC')
  // ClickHouse expects format like '2026-01-01 00:00:00.000' (no Z suffix)
  const fromStr = params.from.toISOString().replace('T', ' ').replace('Z', '');
  const toStr = params.to.toISOString().replace('T', ' ').replace('Z', '');

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
        AND timestamp >= {from:String}
        AND timestamp <  {to:String}
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
