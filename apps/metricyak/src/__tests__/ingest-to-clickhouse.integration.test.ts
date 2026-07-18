import { createClickHouseClient, migrate, setupKafkaIngestion } from '@metricyak/clickhouse';
import { createKafka, ensureTopics, KafkaEventsProducer } from '@metricyak/queue';
import { KafkaContainer, type StartedKafkaContainer } from '@testcontainers/kafka';
import { GenericContainer, Network, type StartedNetwork, type StartedTestContainer, Wait } from 'testcontainers';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createMetricReads } from '@/modules/aggregates/aggregates.reads.js';
import { createClickHouseReadsAggregates } from '@/modules/aggregates/clickhouse-reads.js';

describe('ingest -> Kafka -> ClickHouse -> MetricReads (integration)', () => {
  let network: StartedNetwork;
  let chContainer: StartedTestContainer;
  let kafkaContainer: StartedKafkaContainer;
  let client: ReturnType<typeof createClickHouseClient>;
  let producer: KafkaEventsProducer;

  beforeAll(async () => {
    network = await new Network().start();

    // The Kafka container's internal "BROKER" listener (port 9092) advertises the container's
    // own Docker hostname, which is only resolvable by other containers sharing its Docker
    // network. ClickHouse's Kafka-engine table dials Kafka from inside its own container, so
    // both containers must join the same explicit Network — the host-mapped port (9093) that
    // this test's own KafkaEventsProducer uses is not reachable from inside another container.
    kafkaContainer = await new KafkaContainer('confluentinc/cp-kafka:7.6.0')
      .withNetwork(network)
      .withExposedPorts(9093)
      .start();

    chContainer = await new GenericContainer('clickhouse/clickhouse-server:24.8')
      .withNetwork(network)
      .withExposedPorts(8123)
      .withEnvironment({ CLICKHOUSE_USER: 'test', CLICKHOUSE_PASSWORD: 'test', CLICKHOUSE_DB: 'test' })
      .withWaitStrategy(Wait.forHttp('/ping', 8123))
      .start();
    const chUrl = `http://test:test@${chContainer.getHost()}:${chContainer.getMappedPort(8123)}/test`;
    client = createClickHouseClient(chUrl);
    await migrate(client);

    const hostBrokers = [`${kafkaContainer.getHost()}:${kafkaContainer.getMappedPort(9093)}`];
    const kafka = createKafka(hostBrokers);
    await ensureTopics(kafka);
    producer = new KafkaEventsProducer(kafka);
    await producer.connect();

    // Reach Kafka via its container hostname on the internal BROKER listener (9092), resolvable
    // only from containers on the same Docker network — not the host-mapped port (9093) above.
    const internalBrokers = [`${kafkaContainer.getHostname()}:9092`];
    await setupKafkaIngestion(client, { brokers: internalBrokers });
  }, 180_000);

  afterAll(async () => {
    await producer?.disconnect();
    await client?.close();
    await kafkaContainer?.stop();
    await chContainer?.stop();
    await network?.stop();
  });

  it('an event published via KafkaEventsProducer is readable through MetricReads', async () => {
    const projectId = '00000000-0000-0000-0000-0000000000aa';
    const metric = {
      metricId: 'metric-1',
      version: 1,
      name: 'Purchases',
      definition: {
        events: [{ key: 'purchases', source: 'web', type: 'purchase', aggregation: 'count' as const }],
      },
    };

    await producer.enqueue({
      projectId,
      batchId: 'batch-1',
      events: [
        { id: '00000000-0000-0000-0000-0000000000b1', insertId: 'e1', name: 'purchase', timestamp: '2026-01-01T00:00:00.000Z', properties: {} },
      ],
    });

    const reads = createMetricReads({ aggregates: createClickHouseReadsAggregates(client) });
    const window = { from: new Date('2026-01-01T00:00:00Z'), to: new Date('2026-01-02T00:00:00Z') };

    // ClickHouse's Kafka-engine consumer polls asynchronously; poll the read side until it
    // observes the event or the test's own timeout fails it.
    let value: number | null = null;
    for (let attempt = 0; attempt < 20; attempt++) {
      value = (await reads.value(metric, projectId, window)).value;
      if (value === 1) break;
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    expect(value).toBe(1);
  }, 30_000);
});
