import { KafkaContainer, type StartedKafkaContainer } from '@testcontainers/kafka';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createKafka, ensureTopics } from '@/kafka/connection.js';
import { KafkaEventsProducer } from '@/kafka/events-producer.js';
import { TOPICS } from '@/kafka/topics.js';

describe('kafka connection + topics (integration)', () => {
  let container: StartedKafkaContainer;
  let brokers: string[];

  beforeAll(async () => {
    container = await new KafkaContainer('confluentinc/cp-kafka:7.6.0')
      .withExposedPorts(9093)
      .start();
    brokers = [`${container.getHost()}:${container.getMappedPort(9093)}`];
  }, 120_000);

  afterAll(async () => {
    await container?.stop();
  });

  it('ensureTopics creates the three topics with 48 partitions', async () => {
    const kafka = createKafka(brokers);
    await ensureTopics(kafka);
    const admin = kafka.admin();
    await admin.connect();
    const meta = await admin.fetchTopicMetadata({ topics: Object.values(TOPICS) });
    await admin.disconnect();
    const byName = Object.fromEntries(meta.topics.map((t) => [t.name, t.partitions.length]));
    expect(byName[TOPICS.eventsRaw]).toBe(48);
    expect(byName[TOPICS.matchedEvents]).toBe(48);
    expect(byName[TOPICS.metricBuckets]).toBe(48);
  });
});

describe('KafkaEventsProducer', () => {
  it('sends one keyed message per event to events.raw', async () => {
    const sent: { topic: string; messages: { key: string; value: string }[] }[] = [];
    const fakeProducer = {
      connect: async () => {},
      disconnect: async () => {},
      send: async (r: { topic: string; messages: { key: string; value: string }[] }) => {
        sent.push(r);
      },
    };
    const fakeKafka = { producer: () => fakeProducer } as never;
    const producer = new KafkaEventsProducer(fakeKafka);
    await producer.enqueue({
      batchId: 'b1',
      projectId: 'p1',
      events: [
        {
          id: 'e1',
          insertId: 'i1',
          name: 'signup',
          timestamp: '2026-01-01T00:00:00.000Z',
          properties: {},
        },
        {
          id: 'e2',
          insertId: 'i2',
          name: 'signup',
          timestamp: '2026-01-01T00:00:01.000Z',
          properties: {},
        },
      ],
    } as never);
    expect(sent).toHaveLength(1);
    expect(sent[0]?.topic).toBe('events.raw');
    expect(sent[0]?.messages.map((m) => m.key)).toEqual(['i1', 'i2']);
  });
});
