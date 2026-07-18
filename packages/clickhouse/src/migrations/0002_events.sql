CREATE TABLE IF NOT EXISTS events
(
  id         UUID,
  project_id UUID,
  insert_id  String,
  name       String,
  timestamp  DateTime64(3, 'UTC'),
  properties String
)
ENGINE = ReplacingMergeTree
PARTITION BY toYYYYMM(timestamp)
ORDER BY (project_id, insert_id)
SETTINGS non_replicated_deduplication_window = 1000
