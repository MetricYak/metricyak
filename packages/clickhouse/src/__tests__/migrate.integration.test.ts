import { GenericContainer, type StartedTestContainer, Wait } from 'testcontainers';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createClickHouseClient } from '@/client.js';
import { migrate } from '@/migrate.js';

describe('migrate (integration)', () => {
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

  it('creates both tables idempotently', async () => {
    const client = createClickHouseClient(url);
    await migrate(client);
    await migrate(client); // second run must not throw (IF NOT EXISTS)

    const rs = await client.query({
      query: "SELECT name FROM system.tables WHERE database = 'test' ORDER BY name",
      format: 'JSONEachRow',
    });
    const rows = await rs.json<{ name: string }>();
    expect(rows.map((r) => r.name)).toEqual(['events', 'metric_buckets']);
    await client.close();
  });

  it('sums SimpleAggregateFunction partials via plain GROUP BY', async () => {
    const client = createClickHouseClient(url);
    await migrate(client);
    const base = {
      metric_id: '00000000-0000-0000-0000-000000000001',
      metric_version: 1,
      granularity: 'minute',
      bucket_start: '2026-01-01 00:00:00.000',
      series_key: 's',
      dim_name: '$total',
      dim_value: '$total',
      min: 2,
      max: 9,
    };
    await client.insert({
      table: 'metric_buckets',
      format: 'JSONEachRow',
      values: [
        { ...base, count: 3, sum: 10 },
        { ...base, count: 2, sum: 5 }, // same key → two rows, engine will merge; read sums
      ],
    });
    const rs = await client.query({
      query:
        'SELECT sum(count) AS c, sum(sum) AS s, min(min) AS mn, max(max) AS mx FROM metric_buckets GROUP BY metric_id',
      format: 'JSONEachRow',
    });
    const [row] = await rs.json<{ c: string; s: number; mn: number; mx: number }>();
    expect({ ...row, c: Number(row?.c) }).toEqual({ c: 5, s: 15, mn: 2, mx: 9 });
    await client.close();
  });

  it('drops a re-inserted block with the same insert_deduplication_token', async () => {
    const client = createClickHouseClient(url);
    await migrate(client);
    const row = {
      id: '00000000-0000-0000-0000-0000000000aa',
      project_id: '00000000-0000-0000-0000-0000000000bb',
      insert_id: 'evt-1',
      name: 'signup',
      timestamp: '2026-01-01 00:00:00.000',
      properties: '{}',
    };
    const opts = { table: 'events', format: 'JSONEachRow' as const, values: [row] };
    await client.insert({ ...opts, clickhouse_settings: { insert_deduplication_token: 'tok-1' } });
    await client.insert({ ...opts, clickhouse_settings: { insert_deduplication_token: 'tok-1' } });
    const rs = await client.query({
      query: 'SELECT count() AS n FROM events',
      format: 'JSONEachRow',
    });
    const rows = await rs.json<{ n: number }>();
    expect(Number(rows[0]?.n)).toBe(1);
    await client.close();
  });
});
