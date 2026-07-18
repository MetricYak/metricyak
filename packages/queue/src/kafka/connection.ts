import { Kafka } from 'kafkajs';
import { TOPIC_SPECS } from '@/kafka/topics.js';

export function createKafka(brokers: string[]): Kafka {
  return new Kafka({ clientId: 'metricyak', brokers });
}

export async function ensureTopics(kafka: Kafka): Promise<void> {
  const admin = kafka.admin();
  await admin.connect();
  try {
    const existing = new Set(await admin.listTopics());
    const toCreate = TOPIC_SPECS.filter((s) => !existing.has(s.topic));
    if (toCreate.length > 0) {
      await admin.createTopics({ topics: toCreate });
    }
  } finally {
    await admin.disconnect();
  }
}
