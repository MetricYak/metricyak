import { createClickHouseClient, migrate } from '@metricyak/clickhouse';
import { GenericContainer, type StartedTestContainer, Wait } from 'testcontainers';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { chRawBreakdown } from '@/modules/aggregates/clickhouse-reads.js';

const PROJECT_ID = '00000000-0000-0000-0000-0000000000aa';

describe('clickhouse-reads (integration)', () => {
  let container: StartedTestContainer;
  let client: ReturnType<typeof createClickHouseClient>;

  beforeAll(async () => {
    container = await new GenericContainer('clickhouse/clickhouse-server:24.8')
      .withExposedPorts(8123)
      .withEnvironment({ CLICKHOUSE_USER: 'test', CLICKHOUSE_PASSWORD: 'test', CLICKHOUSE_DB: 'test' })
      .withWaitStrategy(Wait.forHttp('/ping', 8123))
      .start();
    const url = `http://test:test@${container.getHost()}:${container.getMappedPort(8123)}/test`;
    client = createClickHouseClient(url);
    await migrate(client);
  }, 120_000);

  afterAll(async () => {
    await client?.close();
    await container?.stop();
  });

  beforeEach(async () => {
    await client.command({ query: 'TRUNCATE TABLE events' });
  });

  async function seedPurchases(): Promise<void> {
    await client.insert({
      table: 'events',
      format: 'JSONEachRow',
      values: [
        { id: '00000000-0000-0000-0000-0000000000b1', project_id: PROJECT_ID, insert_id: 'e1', name: 'purchase', timestamp: '2026-01-01 00:00:00.000', properties: JSON.stringify({ country: 'US', amount: '10' }) },
        { id: '00000000-0000-0000-0000-0000000000b2', project_id: PROJECT_ID, insert_id: 'e2', name: 'purchase', timestamp: '2026-01-01 00:01:00.000', properties: JSON.stringify({ country: 'US', amount: '5' }) },
        { id: '00000000-0000-0000-0000-0000000000b3', project_id: PROJECT_ID, insert_id: 'e3', name: 'purchase', timestamp: '2026-01-01 00:02:00.000', properties: JSON.stringify({ country: 'CA', amount: '7' }) },
        { id: '00000000-0000-0000-0000-0000000000b4', project_id: PROJECT_ID, insert_id: 'e4', name: 'purchase', timestamp: '2026-01-01 00:03:00.000', properties: JSON.stringify({ country: 'US', amount: 'n/a' }) },
      ],
    });
  }

  it('rawBreakdown groups by a property dimension and extracts numeric values as NULL-safe', async () => {
    await seedPurchases();

    const rows = await chRawBreakdown(client, {
      projectId: PROJECT_ID,
      eventNames: ['purchase'],
      dimField: 'country',
      valuePath: ['amount'],
      from: new Date('2026-01-01T00:00:00Z'),
      to: new Date('2026-01-02T00:00:00Z'),
    });

    const byDim = Object.fromEntries(rows.map((r) => [r.dimValue, r]));
    expect(byDim.US).toMatchObject({ count: 3, sum: 15, min: 5, max: 10 }); // 'n/a' ignored in sum/min/max
    expect(byDim.CA).toMatchObject({ count: 1, sum: 7, min: 7, max: 7 });
  });

  it('falls back to $other when the dimension key is absent from properties', async () => {
    await client.insert({
      table: 'events',
      format: 'JSONEachRow',
      values: [
        { id: '00000000-0000-0000-0000-0000000000c1', project_id: PROJECT_ID, insert_id: 'e5', name: 'purchase', timestamp: '2026-01-01 00:00:00.000', properties: JSON.stringify({ amount: '9' }) },
      ],
    });

    const rows = await chRawBreakdown(client, {
      projectId: PROJECT_ID,
      eventNames: ['purchase'],
      dimField: 'country',
      valuePath: ['amount'],
      from: new Date('2026-01-01T00:00:00Z'),
      to: new Date('2026-01-02T00:00:00Z'),
    });

    expect(rows).toEqual([{ dimValue: '$other', count: 1, sum: 9, min: 9, max: 9 }]);
  });
});
