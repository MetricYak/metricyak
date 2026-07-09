import { and, eq, gte, inArray, lt, lte, type SQL, sql } from 'drizzle-orm';
import type { Database, Executor } from '../client.js';
import {
  aggregationBatches,
  type BucketGranularity,
  dirtyBuckets,
  metricBuckets,
  metricDimensionValues,
  OTHER_SENTINEL,
  VALUE_SERIES,
} from '../schema/aggregates.js';
import { events } from '../schema/events.js';

export type BucketPartialDelta = {
  metricId: string;
  metricVersion: number;
  granularity: BucketGranularity;
  bucketStart: Date;
  seriesKey: string;
  dimName: string;
  dimValue: string;
  count: number;
  sum: number;
  min: number | null;
  max: number | null;
};

export type ValueBucketRow = {
  metricId: string;
  metricVersion: number;
  granularity: BucketGranularity;
  bucketStart: Date;
  dimName: string;
  dimValue: string;
  value: number | null;
};

export type PartialRow = {
  bucketStart: Date;
  seriesKey: string;
  dimName: string;
  dimValue: string;
  count: number;
  sum: number;
  min: number | null;
  max: number | null;
};

export type DirtyEntry = {
  metricId: string;
  metricVersion: number;
  dayStart: Date;
};

export type DirtyClaim = {
  highWaterMark: number;
  entries: DirtyEntry[];
};

export type TimeseriesPoint = {
  bucketStart: Date;
  dimValue: string;
  value: number | null;
};

export type RawBreakdownRow = {
  dimValue: string;
  count: number;
  sum: number;
  min: number | null;
  max: number | null;
};

type DimensionValueEntry = {
  metricId: string;
  metricVersion: number;
  dimName: string;
  dimValue: string;
};

function compareStrings(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function compareBucketDeltas(a: BucketPartialDelta, b: BucketPartialDelta): number {
  return (
    compareStrings(a.metricId, b.metricId) ||
    a.metricVersion - b.metricVersion ||
    compareStrings(a.granularity, b.granularity) ||
    a.bucketStart.getTime() - b.bucketStart.getTime() ||
    compareStrings(a.seriesKey, b.seriesKey) ||
    compareStrings(a.dimName, b.dimName) ||
    compareStrings(a.dimValue, b.dimValue)
  );
}

function compareDimensionEntries(a: DimensionValueEntry, b: DimensionValueEntry): number {
  return (
    compareStrings(a.metricId, b.metricId) ||
    a.metricVersion - b.metricVersion ||
    compareStrings(a.dimName, b.dimName) ||
    compareStrings(a.dimValue, b.dimValue)
  );
}

export function sortBucketDeltas(deltas: readonly BucketPartialDelta[]): BucketPartialDelta[] {
  return [...deltas].sort(compareBucketDeltas);
}

export function sortDimensionEntries<T extends DimensionValueEntry>(entries: readonly T[]): T[] {
  return [...entries].sort(compareDimensionEntries);
}

function jsonTextAccessor(path: readonly string[]): SQL {
  let accessor: SQL = sql`properties`;
  path.forEach((segment, index) => {
    accessor =
      index === path.length - 1 ? sql`${accessor} ->> ${segment}` : sql`${accessor} -> ${segment}`;
  });
  return accessor;
}

export class AggregatesRepository {
  constructor(private readonly db: Database) {}

  async claimBatch(
    batchId: string,
    projectId: string,
    executor: Executor = this.db,
  ): Promise<boolean> {
    const inserted = await executor
      .insert(aggregationBatches)
      .values({ batchId, projectId })
      .onConflictDoNothing({ target: aggregationBatches.batchId })
      .returning({ batchId: aggregationBatches.batchId });

    return inserted.length > 0;
  }

  async upsertBaseBuckets(
    deltas: BucketPartialDelta[],
    executor: Executor = this.db,
  ): Promise<void> {
    if (deltas.length === 0) return;

    await executor
      .insert(metricBuckets)
      .values(sortBucketDeltas(deltas))
      .onConflictDoUpdate({
        target: [
          metricBuckets.metricId,
          metricBuckets.metricVersion,
          metricBuckets.granularity,
          metricBuckets.bucketStart,
          metricBuckets.seriesKey,
          metricBuckets.dimName,
          metricBuckets.dimValue,
        ],
        set: {
          count: sql`${metricBuckets.count} + excluded.count`,
          sum: sql`${metricBuckets.sum} + excluded.sum`,
          min: sql`least(${metricBuckets.min}, excluded.min)`,
          max: sql`greatest(${metricBuckets.max}, excluded.max)`,
          updatedAt: sql`now()`,
        },
      });
  }

  async registerDimensionValues(
    entries: readonly {
      metricId: string;
      metricVersion: number;
      dimName: string;
      dimValue: string;
    }[],
    executor: Executor = this.db,
  ): Promise<void> {
    if (entries.length === 0) return;

    await executor
      .insert(metricDimensionValues)
      .values(sortDimensionEntries(entries).map((entry) => ({ ...entry })))
      .onConflictDoNothing();
  }

  async countDimensionValues(
    metricId: string,
    metricVersion: number,
    dimName: string,
    executor: Executor = this.db,
  ): Promise<number> {
    const [row] = await executor
      .select({ count: sql<number>`cast(count(*) as int)` })
      .from(metricDimensionValues)
      .where(
        and(
          eq(metricDimensionValues.metricId, metricId),
          eq(metricDimensionValues.metricVersion, metricVersion),
          eq(metricDimensionValues.dimName, dimName),
        ),
      );

    return row?.count ?? 0;
  }

  async knownDimensionValues(
    metricId: string,
    metricVersion: number,
    dimName: string,
    executor: Executor = this.db,
  ): Promise<Set<string>> {
    const rows = await executor
      .select({ dimValue: metricDimensionValues.dimValue })
      .from(metricDimensionValues)
      .where(
        and(
          eq(metricDimensionValues.metricId, metricId),
          eq(metricDimensionValues.metricVersion, metricVersion),
          eq(metricDimensionValues.dimName, dimName),
        ),
      );

    return new Set(rows.map((row) => row.dimValue));
  }

  async recordDirty(entries: readonly DirtyEntry[], executor: Executor = this.db): Promise<void> {
    if (entries.length === 0) return;

    await executor.insert(dirtyBuckets).values(entries.map((entry) => ({ ...entry })));
  }

  async claimDirty(executor: Executor = this.db): Promise<DirtyClaim> {
    const [head] = await executor
      .select({ highWaterMark: sql<number | null>`max(${dirtyBuckets.id})` })
      .from(dirtyBuckets);

    const highWaterMark = head?.highWaterMark ?? null;
    if (highWaterMark === null) {
      return { highWaterMark: 0, entries: [] };
    }

    const entries = await executor
      .selectDistinct({
        metricId: dirtyBuckets.metricId,
        metricVersion: dirtyBuckets.metricVersion,
        dayStart: dirtyBuckets.dayStart,
      })
      .from(dirtyBuckets)
      .where(lte(dirtyBuckets.id, highWaterMark));

    return { highWaterMark, entries };
  }

  async deleteDirtyUpTo(highWaterMark: number, executor: Executor = this.db): Promise<void> {
    await executor.delete(dirtyBuckets).where(lte(dirtyBuckets.id, highWaterMark));
  }

  async acquireMetricLock(metricId: string, executor: Executor = this.db): Promise<void> {
    await executor.execute(sql`select pg_advisory_xact_lock(hashtext(${metricId}))`);
  }

  async recomputeTier(
    params: {
      metricId: string;
      metricVersion: number;
      from: BucketGranularity;
      to: BucketGranularity;
      truncUnit: 'hour' | 'day';
      rangeStart: Date;
      rangeEnd: Date;
    },
    executor: Executor = this.db,
  ): Promise<void> {
    const { metricId, metricVersion, from, to, truncUnit, rangeStart, rangeEnd } = params;
    const trunc = sql.raw(
      `date_trunc('${truncUnit}', bucket_start at time zone 'UTC') at time zone 'UTC'`,
    );

    await executor.execute(sql`
      insert into metric_buckets (
        metric_id, metric_version, granularity, bucket_start, series_key, dim_name, dim_value,
        count, sum, min, max, value, updated_at
      )
      select
        metric_id, metric_version, ${to}::bucket_granularity, ${trunc},
        series_key, dim_name, dim_value,
        sum(count), sum(sum), min(min), max(max), null::double precision, now()
      from metric_buckets
      where metric_id = ${metricId}::uuid
        and metric_version = ${metricVersion}
        and granularity = ${from}::bucket_granularity
        and series_key <> ${VALUE_SERIES}
        and bucket_start >= ${rangeStart}
        and bucket_start < ${rangeEnd}
      group by metric_id, metric_version, ${trunc}, series_key, dim_name, dim_value
      on conflict (metric_id, metric_version, granularity, bucket_start, series_key, dim_name, dim_value)
      do update set
        count = excluded.count,
        sum = excluded.sum,
        min = excluded.min,
        max = excluded.max,
        updated_at = now()
    `);
  }

  async getPartials(
    params: {
      metricId: string;
      metricVersion: number;
      granularity: BucketGranularity;
      rangeStart: Date;
      rangeEnd: Date;
    },
    executor: Executor = this.db,
  ): Promise<PartialRow[]> {
    const { metricId, metricVersion, granularity, rangeStart, rangeEnd } = params;

    return executor
      .select({
        bucketStart: metricBuckets.bucketStart,
        seriesKey: metricBuckets.seriesKey,
        dimName: metricBuckets.dimName,
        dimValue: metricBuckets.dimValue,
        count: metricBuckets.count,
        sum: metricBuckets.sum,
        min: metricBuckets.min,
        max: metricBuckets.max,
      })
      .from(metricBuckets)
      .where(
        and(
          eq(metricBuckets.metricId, metricId),
          eq(metricBuckets.metricVersion, metricVersion),
          eq(metricBuckets.granularity, granularity),
          sql`${metricBuckets.seriesKey} <> ${VALUE_SERIES}`,
          gte(metricBuckets.bucketStart, rangeStart),
          lt(metricBuckets.bucketStart, rangeEnd),
        ),
      );
  }

  async upsertValueBuckets(rows: ValueBucketRow[], executor: Executor = this.db): Promise<void> {
    if (rows.length === 0) return;

    await executor
      .insert(metricBuckets)
      .values(rows.map((row) => ({ ...row, seriesKey: VALUE_SERIES })))
      .onConflictDoUpdate({
        target: [
          metricBuckets.metricId,
          metricBuckets.metricVersion,
          metricBuckets.granularity,
          metricBuckets.bucketStart,
          metricBuckets.seriesKey,
          metricBuckets.dimName,
          metricBuckets.dimValue,
        ],
        set: {
          value: sql`excluded.value`,
          updatedAt: sql`now()`,
        },
      });
  }

  async getValueTimeseries(
    params: {
      metricId: string;
      metricVersion: number;
      granularity: BucketGranularity;
      from: Date;
      to: Date;
      dimName: string;
      dimValues?: readonly string[];
    },
    executor: Executor = this.db,
  ): Promise<TimeseriesPoint[]> {
    const { metricId, metricVersion, granularity, from, to, dimName, dimValues } = params;

    const filters = [
      eq(metricBuckets.metricId, metricId),
      eq(metricBuckets.metricVersion, metricVersion),
      eq(metricBuckets.granularity, granularity),
      eq(metricBuckets.seriesKey, VALUE_SERIES),
      eq(metricBuckets.dimName, dimName),
      gte(metricBuckets.bucketStart, from),
      lt(metricBuckets.bucketStart, to),
    ];
    if (dimValues && dimValues.length > 0) {
      filters.push(inArray(metricBuckets.dimValue, [...dimValues]));
    }

    return executor
      .select({
        bucketStart: metricBuckets.bucketStart,
        dimValue: metricBuckets.dimValue,
        value: metricBuckets.value,
      })
      .from(metricBuckets)
      .where(and(...filters))
      .orderBy(metricBuckets.bucketStart);
  }

  async rawBreakdown(
    params: {
      projectId: string;
      eventNames: readonly string[];
      dimField: string;
      valuePath: readonly string[] | null;
      from: Date;
      to: Date;
    },
    executor: Executor = this.db,
  ): Promise<RawBreakdownRow[]> {
    const { projectId, eventNames, dimField, valuePath, from, to } = params;
    if (eventNames.length === 0) return [];

    const dim = sql`coalesce(properties ->> ${dimField}, ${OTHER_SENTINEL})`;
    const value =
      valuePath && valuePath.length > 0
        ? sql`case when ${jsonTextAccessor(valuePath)} ~ '^-?[0-9]+(\\.[0-9]+)?([eE][+-]?[0-9]+)?$' then (${jsonTextAccessor(valuePath)})::double precision end`
        : sql`null::double precision`;

    const result = await executor.execute<RawBreakdownRow>(sql`
      select
        ${dim} as "dimValue",
        cast(count(*) as int) as "count",
        coalesce(sum(${value}), 0) as "sum",
        min(${value}) as "min",
        max(${value}) as "max"
      from events
      where project_id = ${projectId}::uuid
        and ${inArray(events.name, [...eventNames])}
        and timestamp >= ${from}
        and timestamp < ${to}
      group by 1
    `);

    return [...result.rows];
  }
}
