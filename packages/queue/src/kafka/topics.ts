// Raw events are the only Kafka topic in the pull model: HTTP ingest publishes here and
// ClickHouse pulls from it (Kafka engine table + materialized view) into the events table.
// The former Stage-1/Stage-2 topics (matched.events / metric.buckets) are gone with the
// capped-bucket pipeline — see #72.
export const TOPICS = {
  eventsRaw: 'events.raw',
} as const;

export type TopicName = (typeof TOPICS)[keyof typeof TOPICS];

const DEFAULT_PARTITIONS = 48;

export const TOPIC_SPECS: { topic: TopicName; numPartitions: number; replicationFactor: number }[] =
  [{ topic: TOPICS.eventsRaw, numPartitions: DEFAULT_PARTITIONS, replicationFactor: 1 }];
