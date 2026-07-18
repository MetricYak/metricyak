import { GenericContainer, type StartedTestContainer, Wait } from 'testcontainers';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createClickHouseClient } from '@/client.js';
import { EVENTS_PROJECTION, setupKafkaIngestion } from '@/kafka-ingestion.js';
import { migrate } from '@/migrate.js';

// ClickHouse creates a Kafka engine table lazily — it does not dial the broker at DDL time —
// so a single ClickHouse container validates that the engine table + materialized-view SQL
// (JSON extraction, virtual-column error routing) is correct and creatable. End-to-end
// consumption across a live Kafka broker is exercised separately.
describe('setupKafkaIngestion (integration)', () => {
  let container: StartedTestContainer;
  let url: string;

  beforeAll(async () => {
    container = await new GenericContainer('clickhouse/clickhouse-server:24.8')
      .withExposedPorts(8123)
      .withEnvironment({
        CLICKHOUSE_USER: 'test',
        CLICKHOUSE_PASSWORD: 'test',
        CLICKHOUSE_DB: 'test',
      })
      .withWaitStrategy(Wait.forHttp('/ping', 8123))
      .start();
    url = `http://test:test@${container.getHost()}:${container.getMappedPort(8123)}/test`;
  }, 120_000);

  afterAll(async () => {
    await container?.stop();
  });

  it('creates the ingestion objects idempotently', async () => {
    const client = createClickHouseClient(url);
    await migrate(client);
    const opts = { brokers: ['kafka:29092'], topic: 'events.raw' };
    await setupKafkaIngestion(client, opts);
    await setupKafkaIngestion(client, opts); // IF NOT EXISTS → second run must not throw

    const rs = await client.query({
      query: "SELECT name FROM system.tables WHERE database = 'test' ORDER BY name",
      format: 'JSONEachRow',
    });
    const names = (await rs.json<{ name: string }>()).map((r) => r.name);
    expect(names).toEqual([
      'events',
      'events_errors',
      'events_errors_mv',
      'events_mv',
      'events_queue',
    ]);
    await client.close();
  });

  it('configures the Kafka engine table against the requested topic and broker', async () => {
    const client = createClickHouseClient(url);
    await migrate(client);
    await setupKafkaIngestion(client, { brokers: ['kafka:29092'], topic: 'events.raw' });

    const rs = await client.query({
      query:
        "SELECT engine, engine_full FROM system.tables WHERE database = 'test' AND name = 'events_queue'",
      format: 'JSONEachRow',
    });
    const [row] = await rs.json<{ engine: string; engine_full: string }>();
    expect(row?.engine).toBe('Kafka');
    expect(row?.engine_full).toContain("kafka_topic_list = 'events.raw'");
    expect(row?.engine_full).toContain("kafka_broker_list = 'kafka:29092'");
    await client.close();
  });

  // Guards the nullable-insertId contract: a null/absent insertId must coalesce to the event
  // id (so the row persists with a unique dedup key), mirroring the Postgres partial unique
  // index `(project_id, insert_id) WHERE insert_id IS NOT NULL`. Runs the real MV projection
  // against literal payloads. Regression against "fixing" insert_id into a Nullable column,
  // which would collapse every null-insertId event for a project into one row.
  it('coalesces a null/absent insertId to the event id (matches the Postgres path)', async () => {
    const client = createClickHouseClient(url);
    const id = '00000000-0000-0000-0000-0000000000a1';
    const projectId = '00000000-0000-0000-0000-0000000000b1';
    const cases = [
      { label: 'insertId null', raw: JSON.stringify({ id, projectId, insertId: null }) },
      { label: 'insertId absent', raw: JSON.stringify({ id, projectId }) },
      { label: 'insertId empty', raw: JSON.stringify({ id, projectId, insertId: '' }) },
      { label: 'insertId present', raw: JSON.stringify({ id, projectId, insertId: 'evt-9' }) },
    ];

    for (const c of cases) {
      const rs = await client.query({
        query: `SELECT insert_id FROM (SELECT ${EVENTS_PROJECTION} FROM (SELECT {raw:String} AS raw))`,
        query_params: { raw: c.raw },
        format: 'JSONEachRow',
      });
      const [out] = await rs.json<{ insert_id: string }>();
      const expected = c.label === 'insertId present' ? 'evt-9' : id;
      expect(out?.insert_id, c.label).toBe(expected);
    }
    await client.close();
  });
});
