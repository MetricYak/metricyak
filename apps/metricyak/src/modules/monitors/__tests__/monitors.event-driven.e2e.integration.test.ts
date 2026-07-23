import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  type ClickHouseClient,
  createClickHouseClient,
  migrate as migrateClickHouse,
} from '@metricyak/clickhouse';
import { InMemoryMonitorDirtyBuffer, InMemoryMonitorEvalProducer } from '@metricyak/queue';
import {
  type Database,
  MetricsRepository,
  MonitorEventKeysRepository,
  MonitorRuntimeRepository,
  monitors,
  organizations,
  projects,
  TOTAL_SENTINEL,
} from '@metricyak/storage';
import * as schema from '@metricyak/storage/schema';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { eq, sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import { GenericContainer, type StartedTestContainer, Wait } from 'testcontainers';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createMetricReads } from '@/modules/aggregates/aggregates.reads.js';
import { createClickHouseReadsAggregates } from '@/modules/aggregates/clickhouse-reads.js';
import { runMonitorDrain } from '@/modules/monitors/monitors.drain.js';
import { processMonitorEvalJob } from '@/modules/monitors/monitors.eval.js';

const migrationsFolder = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../../../../packages/storage/migrations',
);

describe('event-driven monitor trigger (end-to-end integration)', () => {
  let container: StartedPostgreSqlContainer;
  let pool: Pool;
  let db: Database;
  let chContainer: StartedTestContainer;
  let chClient: ClickHouseClient;
  let projectId: string;
  let metrics: MetricsRepository;
  let monitorRuntime: MonitorRuntimeRepository;

  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgres:17-alpine').start();
    pool = new Pool({ connectionString: container.getConnectionUri() });
    db = drizzle({ client: pool, schema, casing: 'snake_case' });
    await migrate(db, { migrationsFolder });

    chContainer = await new GenericContainer('clickhouse/clickhouse-server:24.8')
      .withExposedPorts(8123)
      .withEnvironment({
        CLICKHOUSE_USER: 'test',
        CLICKHOUSE_PASSWORD: 'test',
        CLICKHOUSE_DB: 'test',
      })
      .withWaitStrategy(Wait.forHttp('/ping', 8123))
      .start();
    chClient = createClickHouseClient(
      `http://test:test@${chContainer.getHost()}:${chContainer.getMappedPort(8123)}/test`,
    );
    await migrateClickHouse(chClient);
  }, 120_000);

  afterAll(async () => {
    await pool?.end();
    await container?.stop();
    await chClient?.close();
    await chContainer?.stop();
  });

  beforeEach(async () => {
    await db.execute(
      sql`truncate table monitor_event_keys, monitor_events, monitor_state, monitors, metric_definition_versions, metric_definitions, projects, organizations restart identity cascade`,
    );
    await chClient.command({ query: 'TRUNCATE TABLE events' });

    const [org] = await db.insert(organizations).values({ slug: 'acme', name: 'Acme' }).returning();
    if (!org) throw new Error('seed org');
    const [project] = await db
      .insert(projects)
      .values({ organizationId: org.id, name: 'Proj' })
      .returning();
    if (!project) throw new Error('seed project');
    projectId = project.id;

    metrics = new MetricsRepository(db);
    monitorRuntime = new MonitorRuntimeRepository(db);
  });

  it('marks dirty, drains to an eval, and fires the monitor', async () => {
    const now = new Date('2026-07-13T12:00:00.000Z');

    const metric = await metrics.create({
      projectId,
      name: 'Purchases',
      definition: {
        events: [{ key: 'purchase', source: 'purchase', type: 'purchase', aggregation: 'count' }],
      },
    });

    const [monitor] = await db
      .insert(monitors)
      .values({
        projectId,
        metricId: metric.id,
        name: 'Purchase spike',
        condition: { operator: 'gt', value: 0 },
        window: '1h',
        holdFor: '0m',
        missingData: 'zero',
        enabled: true,
        nextEvalAt: now,
      })
      .returning();
    if (!monitor) throw new Error('seed monitor');

    const dirty = new InMemoryMonitorDirtyBuffer();
    const keysRepo = new MonitorEventKeysRepository(db);
    const evalProducer = new InMemoryMonitorEvalProducer();

    await keysRepo.sync(monitor.id, projectId, ['purchase']);

    await chClient.insert({
      table: 'events',
      format: 'JSONEachRow',
      values: [
        {
          id: '00000000-0000-0000-1000-000000000000',
          project_id: projectId,
          insert_id: 'evt-1',
          name: 'purchase',
          timestamp: '2026-07-13 11:55:00.000',
          properties: '{}',
        },
      ],
    });

    await dirty.markDirty([{ projectId, eventName: 'purchase' }], new Date(now.getTime() - 10_000));

    const drained = await runMonitorDrain({ dirty, monitorEventKeys: keysRepo, evalProducer }, now);
    expect(drained.enqueued).toBe(1);

    const metricReads = createMetricReads({
      aggregates: createClickHouseReadsAggregates(chClient),
    });
    for (const job of evalProducer.jobs) {
      await processMonitorEvalJob({ db, metrics, metricReads, monitorRuntime }, job.monitorId, now);
    }

    const [event] = await db
      .select()
      .from(schema.monitorEvents)
      .where(eq(schema.monitorEvents.monitorId, monitor.id));
    expect(event?.type).toBe('fired');

    const state = await monitorRuntime.getState(monitor.id, TOTAL_SENTINEL);
    expect(state?.status).toBe('firing');
  });
});
