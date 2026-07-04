import {
  bigint,
  doublePrecision,
  index,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

export const BUCKET_GRANULARITIES = ['minute', 'hour', 'day'] as const;

export type BucketGranularity = (typeof BUCKET_GRANULARITIES)[number];

export const bucketGranularity = pgEnum('bucket_granularity', BUCKET_GRANULARITIES);

export const TOTAL_SENTINEL = '$total';
export const OTHER_SENTINEL = '$other';
export const VALUE_SERIES = '$value';

export const metricBuckets = pgTable(
  'metric_buckets',
  {
    metricId: uuid('metric_id').notNull(),
    metricVersion: integer('metric_version').notNull(),
    granularity: bucketGranularity('granularity').notNull(),
    bucketStart: timestamp('bucket_start', {
      mode: 'date',
      precision: 3,
      withTimezone: true,
    }).notNull(),
    seriesKey: varchar('series_key', { length: 128 }).notNull(),
    dimName: varchar('dim_name', { length: 128 }).notNull().default(TOTAL_SENTINEL),
    dimValue: varchar('dim_value', { length: 256 }).notNull().default(TOTAL_SENTINEL),
    count: bigint('count', { mode: 'number' }).notNull().default(0),
    sum: doublePrecision('sum').notNull().default(0),
    min: doublePrecision('min'),
    max: doublePrecision('max'),
    value: doublePrecision('value'),
    updatedAt: timestamp('updated_at', { mode: 'date', precision: 3, withTimezone: true })
      .defaultNow()
      .$onUpdateFn(() => new Date())
      .notNull(),
  },
  (table) => [
    primaryKey({
      columns: [
        table.metricId,
        table.metricVersion,
        table.granularity,
        table.bucketStart,
        table.seriesKey,
        table.dimName,
        table.dimValue,
      ],
    }),
    index('metric_buckets_series_idx').on(
      table.metricId,
      table.metricVersion,
      table.dimName,
      table.dimValue,
      table.granularity,
      table.bucketStart,
    ),
    index('metric_buckets_breakdown_idx').on(
      table.metricId,
      table.metricVersion,
      table.granularity,
      table.bucketStart,
      table.dimName,
    ),
  ],
);

export const aggregationBatches = pgTable('aggregation_batches', {
  batchId: varchar('batch_id', { length: 64 }).primaryKey(),
  projectId: uuid('project_id').notNull(),
  appliedAt: timestamp('applied_at', { mode: 'date', precision: 3, withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const dirtyBuckets = pgTable(
  'dirty_buckets',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedByDefaultAsIdentity(),
    metricId: uuid('metric_id').notNull(),
    metricVersion: integer('metric_version').notNull(),
    dayStart: timestamp('day_start', { mode: 'date', precision: 3, withTimezone: true }).notNull(),
  },
  (table) => [index('dirty_buckets_metric_idx').on(table.metricId, table.metricVersion)],
);

export const metricDimensionValues = pgTable(
  'metric_dimension_values',
  {
    metricId: uuid('metric_id').notNull(),
    metricVersion: integer('metric_version').notNull(),
    dimName: varchar('dim_name', { length: 128 }).notNull(),
    dimValue: varchar('dim_value', { length: 256 }).notNull(),
    firstSeenAt: timestamp('first_seen_at', { mode: 'date', precision: 3, withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.metricId, table.metricVersion, table.dimName, table.dimValue],
    }),
  ],
);
