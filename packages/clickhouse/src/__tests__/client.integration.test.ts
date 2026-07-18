import { GenericContainer, type StartedTestContainer, Wait } from 'testcontainers';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createClickHouseClient } from '@/client.js';

describe('createClickHouseClient (integration)', () => {
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

  it('connects and runs a trivial query', async () => {
    const client = createClickHouseClient(url);
    const rs = await client.query({ query: 'SELECT 1 AS one', format: 'JSONEachRow' });
    const rows = await rs.json<{ one: number }>();
    expect(rows).toEqual([{ one: 1 }]);
    await client.close();
  });
});
