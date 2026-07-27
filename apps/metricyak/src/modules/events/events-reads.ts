import type { ClickHouseClient } from '@metricyak/clickhouse';

export type EventRecord = {
  readonly id: string;
  readonly name: string;
  readonly timestamp: string;
  readonly properties: Record<string, unknown>;
};

export type PropertyEquals = {
  readonly path: string;
  readonly value: string;
};

export type ListEventsPageParams = {
  readonly projectId: string;
  readonly from: Date | null;
  readonly to: Date | null;
  readonly sort: 'asc' | 'desc';
  readonly page: number;
  readonly pageSize: number;
  readonly names?: readonly string[];
  readonly propertyEquals?: readonly PropertyEquals[];
};

export type ListEventsPageResult = {
  readonly events: EventRecord[];
  readonly hasMore: boolean;
};

type RawEventRow = {
  id: string;
  name: string;
  timestamp: string;
  properties: string;
};

/**
 * ClickHouse's DateTime64(3, 'UTC') JSONEachRow output is `YYYY-MM-DD HH:MM:SS.sss`
 * (space-separated, no zone suffix). Node's `Date` constructor treats that shape as
 * local time, not UTC, so it must be turned into a real ISO string explicitly rather
 * than round-tripped through `new Date(...)`.
 */
function chTimestampToIso(raw: string): string {
  return `${raw.replace(' ', 'T')}Z`;
}

function chDateTime(date: Date): string {
  return date.toISOString().replace('T', ' ').replace('Z', '');
}

function jsonPathArgs(path: string): string {
  return path
    .split('.')
    .map((segment) => `'${segment.replace(/'/g, "\\'")}'`)
    .join(', ');
}

export function sliceHasMore<T>(
  rows: readonly T[],
  pageSize: number,
): { rows: T[]; hasMore: boolean } {
  return { rows: rows.slice(0, pageSize), hasMore: rows.length > pageSize };
}

export async function listEventsPage(
  client: ClickHouseClient,
  params: ListEventsPageParams,
): Promise<ListEventsPageResult> {
  const { projectId, from, to, sort, page, pageSize, names, propertyEquals } = params;
  const direction = sort === 'asc' ? 'ASC' : 'DESC';

  const conditions = ['project_id = {projectId:UUID}'];
  const queryParams: Record<string, string | number | readonly string[]> = {
    projectId,
    pageSizePlusOne: pageSize + 1,
    offset: page * pageSize,
  };
  if (from) {
    conditions.push(`timestamp >= {from:DateTime64(3, 'UTC')}`);
    queryParams.from = chDateTime(from);
  }
  if (to) {
    conditions.push(`timestamp < {to:DateTime64(3, 'UTC')}`);
    queryParams.to = chDateTime(to);
  }
  if (names && names.length > 0) {
    conditions.push('name IN {names:Array(String)}');
    queryParams.names = names;
  }
  propertyEquals?.forEach((predicate, index) => {
    const key = `propertyValue${index}`;
    conditions.push(
      `JSONExtractString(properties, ${jsonPathArgs(predicate.path)}) = {${key}:String}`,
    );
    queryParams[key] = predicate.value;
  });

  const resultSet = await client.query({
    query: `
      SELECT id, name, timestamp, properties FROM events FINAL
      WHERE ${conditions.join(' AND ')}
      ORDER BY timestamp ${direction}, id ${direction}
      LIMIT {pageSizePlusOne:UInt32} OFFSET {offset:UInt32}`,
    query_params: queryParams,
    format: 'JSONEachRow',
  });
  const rawRows = await resultSet.json<RawEventRow>();

  const { rows, hasMore } = sliceHasMore(rawRows, pageSize);
  return {
    events: rows.map((row) => ({
      id: row.id,
      name: row.name,
      timestamp: chTimestampToIso(row.timestamp),
      properties: JSON.parse(row.properties),
    })),
    hasMore,
  };
}

export type EventsReads = {
  listPage(params: ListEventsPageParams): Promise<ListEventsPageResult>;
};

export function createClickHouseEventsReads(client: ClickHouseClient): EventsReads {
  return {
    listPage: (params) => listEventsPage(client, params),
  };
}
