import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  type ClickHouseClient,
  createClickHouseClient,
  migrate as migrateClickHouse,
} from '@metricyak/clickhouse';
import { InMemoryMonitorEvalProducer } from '@metricyak/queue';
import {
  type Database,
  MetricsRepository,
  MonitorRuntimeRepository,
  monitors,
  organizations,
  projects,
} from '@metricyak/storage';
import * as schema from '@metricyak/storage/schema';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import { GenericContainer, type StartedTestContainer, Wait } from 'testcontainers';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createMetricReads } from '@/modules/aggregates/aggregates.reads.js';
import { createClickHouseReadsAggregates } from '@/modules/aggregates/clickhouse-reads.js';
import { runMonitorDispatch } from '@/modules/monitors/monitors.dispatch.js';
import { runMonitorEval } from '@/modules/monitors/monitors.eval.js';

const migrationsFolder = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../../../../packages/storage/migrations',
);

describe('monitor fan-out (integration)', () => {
  let container: StartedPostgreSqlContainer;
  let pool: Pool;
  let db: Database;
  let chContainer: StartedTestContainer;
  let chClient: ClickHouseClient;
  let projectId: string;
  let breachingMonitorId: string;

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
      sql`truncate table monitor_events, monitor_state, monitors, metric_definition_versions, metric_definitions, projects, organizations restart identity cascade`,
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

    const metrics = new MetricsRepository(db);
    const metric = await metrics.create({
      projectId,
      name: 'Purchases',
      definition: {
        events: [{ key: 'purchase', source: 'purchase', type: 'purchase', aggregation: 'count' }],
      },
    });

    // Seed 3000 raw purchase events directly into ClickHouse (bypassing Kafka) — the
    // read path aggregates raw events at query time, so there is no precomputed-count
    // shortcut anymore.
    await chClient.insert({
      table: 'events',
      format: 'JSONEachRow',
      values: Array.from({ length: 3000 }, (_, i) => ({
        id: `00000000-0000-0000-1000-${String(i).padStart(12, '0')}`,
        project_id: projectId,
        insert_id: `seed-${i}`,
        name: 'purchase',
        timestamp: '2026-07-13 11:00:00.000',
        properties: '{}',
      })),
    });

    const [breaching] = await db
      .insert(monitors)
      .values({
        projectId,
        metricId: metric.id,
        name: 'Revenue floor',
        condition: { operator: 'lt', value: 5000 },
        window: '1d',
        holdFor: '0m',
        missingData: 'zero',
        enabled: true,
        nextEvalAt: new Date('2026-07-13T12:00:00.000Z'),
      })
      .returning();
    if (!breaching) throw new Error('seed breaching monitor');
    breachingMonitorId = breaching.id;

    const [healthy] = await db
      .insert(monitors)
      .values({
        projectId,
        metricId: metric.id,
        name: 'Revenue ceiling',
        condition: { operator: 'gt', value: 5000 },
        window: '1d',
        holdFor: '0m',
        missingData: 'zero',
        enabled: true,
        nextEvalAt: new Date('2026-07-13T12:00:00.000Z'),
      })
      .returning();
    if (!healthy) throw new Error('seed healthy monitor');
  });

  it('dispatch enqueues due monitors; draining evals writes state + one event each', async () => {
    const now = new Date('2026-07-13T12:00:00.000Z');
    const evalProducer = new InMemoryMonitorEvalProducer();
    const runtime = new MonitorRuntimeRepository(db);

    const { dispatched } = await runMonitorDispatch({ monitorRuntime: runtime, evalProducer }, now);
    expect(dispatched).toBeGreaterThanOrEqual(1);

    const evalDeps = {
      db,
      metrics: new MetricsRepository(db),
      metricReads: createMetricReads({ aggregates: createClickHouseReadsAggregates(chClient) }),
      monitorRuntime: runtime,
    };
    const outcomes = await Promise.all(
      evalProducer.jobs.map((j) => runMonitorEval(evalDeps, j.monitorId, now)),
    );
    expect(outcomes.filter((o) => o === 'fired').length).toBe(1);

    const state = await runtime.getState(breachingMonitorId, '$total');
    expect(state?.status).toBe('firing');
    const events = await db.select().from(schema.monitorEvents);
    expect(events).toHaveLength(1);
  });
});
