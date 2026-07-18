import type { ClickHouseClient } from '@/client.js';

export type KafkaIngestionOptions = {
  /** Broker addresses ClickHouse dials from inside its own network, e.g. ['kafka:29092']. */
  brokers: string[];
  /** Source topic. Defaults to the events.raw topic that KafkaEventsProducer publishes to. */
  topic?: string;
  /** Kafka consumer group for the ClickHouse engine. */
  consumerGroup?: string;
};

/**
 * Wire ClickHouse to PULL raw events from Kafka into the `events` table, rather than an
 * app-side worker pushing inserts. Creates:
 *
 *   events_queue      — Kafka engine table consuming `topic` as whole-message JSON strings.
 *   events_mv         — materialized view: parses each message and inserts into `events`.
 *   events_errors     — dead-letter table for messages that fail to parse.
 *   events_errors_mv  — routes poison messages there instead of stalling the consumer.
 *
 * Durability comes from the Kafka engine itself: offsets advance only after the MV's insert
 * commits, so a failed insert is retried, and `kafka_handle_error_mode = 'stream'` keeps a
 * single bad message from blocking the partition. Idempotency is handled downstream by the
 * `events` ReplacingMergeTree deduplicating on (project_id, insert_id).
 *
 * Idempotent: every statement uses IF NOT EXISTS. Run `migrate()` first so `events` exists.
 */
export async function setupKafkaIngestion(
  client: ClickHouseClient,
  opts: KafkaIngestionOptions,
): Promise<void> {
  const brokerList = opts.brokers.join(',');
  const topic = opts.topic ?? 'events.raw';
  const consumerGroup = opts.consumerGroup ?? 'clickhouse-events';

  await client.command({
    query: `
      CREATE TABLE IF NOT EXISTS events_queue
      (
        raw String
      )
      ENGINE = Kafka
      SETTINGS
        kafka_broker_list = '${brokerList}',
        kafka_topic_list = '${topic}',
        kafka_group_name = '${consumerGroup}',
        kafka_format = 'JSONAsString',
        kafka_handle_error_mode = 'stream',
        kafka_num_consumers = 1
    `,
  });

  // Each events.raw message is a JSON object: { id, insertId, name, timestamp, properties, projectId, ... }.
  // insert_id falls back to id so the dedup key is always present (StoredEvent.insertId is nullable).
  await client.command({
    query: `
      CREATE MATERIALIZED VIEW IF NOT EXISTS events_mv TO events AS
      SELECT
        toUUID(JSONExtractString(raw, 'id')) AS id,
        toUUID(JSONExtractString(raw, 'projectId')) AS project_id,
        if(
          JSONExtractString(raw, 'insertId') != '',
          JSONExtractString(raw, 'insertId'),
          JSONExtractString(raw, 'id')
        ) AS insert_id,
        JSONExtractString(raw, 'name') AS name,
        parseDateTime64BestEffort(JSONExtractString(raw, 'timestamp'), 3, 'UTC') AS timestamp,
        if(JSONExtractRaw(raw, 'properties') != '', JSONExtractRaw(raw, 'properties'), '{}') AS properties
      FROM events_queue
      WHERE length(_error) = 0
    `,
  });

  await client.command({
    query: `
      CREATE TABLE IF NOT EXISTS events_errors
      (
        topic     String,
        partition UInt64,
        offset    UInt64,
        raw       String,
        error     String,
        seen_at   DateTime DEFAULT now()
      )
      ENGINE = MergeTree
      ORDER BY (topic, partition, offset)
    `,
  });

  await client.command({
    query: `
      CREATE MATERIALIZED VIEW IF NOT EXISTS events_errors_mv TO events_errors AS
      SELECT
        _topic AS topic,
        _partition AS partition,
        _offset AS offset,
        _raw_message AS raw,
        _error AS error
      FROM events_queue
      WHERE length(_error) > 0
    `,
  });
}
