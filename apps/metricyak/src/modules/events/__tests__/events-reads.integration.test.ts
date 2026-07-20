import { createClickHouseClient, migrate } from '@metricyak/clickhouse';
import { GenericContainer, type StartedTestContainer, Wait } from 'testcontainers';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { listEventsPage } from '@/modules/events/events-reads.js';

const PROJECT_ID = '00000000-0000-0000-0000-0000000000aa';
const OTHER_PROJECT_ID = '00000000-0000-0000-0000-0000000000bb';

describe('listEventsPage (integration)', () => {
  let container: StartedTestContainer;
  let client: ReturnType<typeof createClickHouseClient>;

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

  async function seed(
    rows: ReadonlyArray<{ id: string; insertId: string; ts: string; projectId?: string }>,
  ): Promise<void> {
    await client.insert({
      table: 'events',
      format: 'JSONEachRow',
      values: rows.map((row) => ({
        id: row.id,
        project_id: row.projectId ?? PROJECT_ID,
        insert_id: row.insertId,
        name: 'page.viewed',
        timestamp: row.ts,
        properties: JSON.stringify({ path: '/pricing' }),
      })),
    });
  }

  it('returns the newest page first and reports hasMore when another page exists', async () => {
    await seed([
      { id: '00000000-0000-0000-0000-0000000000b1', insertId: 'e1', ts: '2026-01-01 00:00:00.000' },
      { id: '00000000-0000-0000-0000-0000000000b2', insertId: 'e2', ts: '2026-01-01 00:01:00.000' },
      { id: '00000000-0000-0000-0000-0000000000b3', insertId: 'e3', ts: '2026-01-01 00:02:00.000' },
    ]);

    const page0 = await listEventsPage(client, {
      projectId: PROJECT_ID,
      from: null,
      to: null,
      sort: 'desc',
      page: 0,
      pageSize: 2,
    });
    expect(page0.hasMore).toBe(true);
    expect(page0.events.map((e) => e.id)).toEqual([
      '00000000-0000-0000-0000-0000000000b3',
      '00000000-0000-0000-0000-0000000000b2',
    ]);
    expect(page0.events[0]?.timestamp).toBe('2026-01-01T00:02:00.000Z');
    expect(page0.events[0]?.properties).toEqual({ path: '/pricing' });

    const page1 = await listEventsPage(client, {
      projectId: PROJECT_ID,
      from: null,
      to: null,
      sort: 'desc',
      page: 1,
      pageSize: 2,
    });
    expect(page1.hasMore).toBe(false);
    expect(page1.events.map((e) => e.id)).toEqual(['00000000-0000-0000-0000-0000000000b1']);
  });

  it('filters by the from/to time range', async () => {
    await seed([
      { id: '00000000-0000-0000-0000-0000000000c1', insertId: 'f1', ts: '2026-01-01 00:00:00.000' },
      { id: '00000000-0000-0000-0000-0000000000c2', insertId: 'f2', ts: '2026-01-02 00:00:00.000' },
    ]);

    const result = await listEventsPage(client, {
      projectId: PROJECT_ID,
      from: new Date('2026-01-01T12:00:00Z'),
      to: null,
      sort: 'desc',
      page: 0,
      pageSize: 25,
    });

    expect(result.events.map((e) => e.id)).toEqual(['00000000-0000-0000-0000-0000000000c2']);
  });

  it('scopes to the given project only', async () => {
    await seed([
      { id: '00000000-0000-0000-0000-0000000000d1', insertId: 'g1', ts: '2026-01-01 00:00:00.000' },
      {
        id: '00000000-0000-0000-0000-0000000000d2',
        insertId: 'g2',
        ts: '2026-01-01 00:00:00.000',
        projectId: OTHER_PROJECT_ID,
      },
    ]);

    const result = await listEventsPage(client, {
      projectId: PROJECT_ID,
      from: null,
      to: null,
      sort: 'desc',
      page: 0,
      pageSize: 25,
    });

    expect(result.events.map((e) => e.id)).toEqual(['00000000-0000-0000-0000-0000000000d1']);
  });

  it('does not double-count a duplicate physical row before a background merge runs', async () => {
    const duplicateRow = {
      id: '00000000-0000-0000-0000-0000000000e1',
      project_id: PROJECT_ID,
      insert_id: 'dup-1',
      name: 'page.viewed',
      timestamp: '2026-01-01 00:00:00.000',
      properties: JSON.stringify({ path: '/pricing' }),
    };
    await client.insert({
      table: 'events',
      format: 'JSONEachRow',
      values: [duplicateRow],
      clickhouse_settings: { insert_deduplicate: 0 },
    });
    await client.insert({
      table: 'events',
      format: 'JSONEachRow',
      values: [duplicateRow],
      clickhouse_settings: { insert_deduplicate: 0 },
    });

    const result = await listEventsPage(client, {
      projectId: PROJECT_ID,
      from: null,
      to: null,
      sort: 'desc',
      page: 0,
      pageSize: 25,
    });

    expect(result.events).toHaveLength(1);
  });
});
