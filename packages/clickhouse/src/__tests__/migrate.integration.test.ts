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

  it('creates the events table idempotently', async () => {
    const client = createClickHouseClient(url);
    await migrate(client);
    await migrate(client); // second run must not throw (IF NOT EXISTS)

    const rs = await client.query({
      query: "SELECT name FROM system.tables WHERE database = 'test' ORDER BY name",
      format: 'JSONEachRow',
    });
    const rows = await rs.json<{ name: string }>();
    expect(rows.map((r) => r.name)).toEqual(['events']);
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
    expect(Number(rows[0]?.n)).toBe(1); // second identical-token insert dropped
    await client.close();
  });
});
