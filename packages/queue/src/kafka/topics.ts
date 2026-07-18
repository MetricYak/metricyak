export const TOPICS = {
  eventsRaw: 'events.raw',
  matchedEvents: 'matched.events',
  metricBuckets: 'metric.buckets',
} as const;

export type TopicName = (typeof TOPICS)[keyof typeof TOPICS];

const DEFAULT_PARTITIONS = 48;

export const TOPIC_SPECS: { topic: TopicName; numPartitions: number; replicationFactor: number }[] =
  [
    { topic: TOPICS.eventsRaw, numPartitions: DEFAULT_PARTITIONS, replicationFactor: 1 },
    { topic: TOPICS.matchedEvents, numPartitions: DEFAULT_PARTITIONS, replicationFactor: 1 },
    { topic: TOPICS.metricBuckets, numPartitions: DEFAULT_PARTITIONS, replicationFactor: 1 },
  ];
