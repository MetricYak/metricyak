CREATE TABLE IF NOT EXISTS metric_buckets
(
  metric_id      UUID,
  metric_version Int32,
  granularity    LowCardinality(String),
  bucket_start   DateTime64(3, 'UTC'),
  series_key     String,
  dim_name       String,
  dim_value      String,
  count          SimpleAggregateFunction(sum, UInt64),
  sum            SimpleAggregateFunction(sum, Float64),
  min            SimpleAggregateFunction(min, Nullable(Float64)),
  max            SimpleAggregateFunction(max, Nullable(Float64))
)
ENGINE = AggregatingMergeTree
PARTITION BY toYYYYMM(bucket_start)
ORDER BY (metric_id, metric_version, granularity, bucket_start, series_key, dim_name, dim_value)
SETTINGS non_replicated_deduplication_window = 1000
