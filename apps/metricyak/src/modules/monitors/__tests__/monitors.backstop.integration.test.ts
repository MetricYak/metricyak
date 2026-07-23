import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { InMemoryMonitorDirtyBuffer, InMemoryMonitorEvalProducer } from '@metricyak/queue';
import {
  type Database,
  MetricsRepository,
  MonitorEventKeysRepository,
  MonitorsRepository,
  organizations,
  projects,
} from '@metricyak/storage';
import * as schema from '@metricyak/storage/schema';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { runMonitorBackstop } from '@/modules/monitors/monitors.backstop.js';

const migrationsFolder = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../../../../packages/storage/migrations',
);

describe('runMonitorBackstop (integration)', () => {
  let container: StartedPostgreSqlContainer;
  let pool: Pool;
  let db: Database;
  let projectId: string;
  let metricId: string;

  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgres:17-alpine').start();
    pool = new Pool({ connectionString: container.getConnectionUri() });
    db = drizzle({ client: pool, schema, casing: 'snake_case' });
    await migrate(db, { migrationsFolder });
  }, 120_000);

  afterAll(async () => {
    await pool?.end();
    await container?.stop();
  });

  beforeEach(async () => {
    await db.execute(
      sql`truncate table monitor_event_keys, monitor_events, monitor_state, monitors, metric_definition_versions, metric_definitions, projects, organizations restart identity cascade`,
    );
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
    metricId = metric.id;
  });

  it('enqueues every enabled monitor and warms membership from synced keys', async () => {
    const dirty = new InMemoryMonitorDirtyBuffer();
    const keysRepo = new MonitorEventKeysRepository(db);
    const monitorsRepo = new MonitorsRepository(db);
    const evalProducer = new InMemoryMonitorEvalProducer();

    const first = await monitorsRepo.create({
      projectId,
      metricId,
      name: 'first',
      condition: { operator: 'gt', value: 1 },
      window: '1h',
      holdFor: '0m',
      enabled: true,
    });
    const second = await monitorsRepo.create({
      projectId,
      metricId,
      name: 'second',
      condition: { operator: 'gt', value: 1 },
      window: '1h',
      holdFor: '0m',
      enabled: true,
    });
    const third = await monitorsRepo.create({
      projectId,
      metricId,
      name: 'third',
      condition: { operator: 'gt', value: 1 },
      window: '1h',
      holdFor: '0m',
      enabled: true,
    });
    const disabled = await monitorsRepo.create({
      projectId,
      metricId,
      name: 'off',
      condition: { operator: 'gt', value: 1 },
      window: '1h',
      holdFor: '0m',
      enabled: false,
    });

    await keysRepo.sync(first.id, projectId, ['purchase']);

    const result = await runMonitorBackstop(
      { monitors: monitorsRepo, monitorEventKeys: keysRepo, dirty, evalProducer },
      new Date('2026-07-22T00:00:10Z'),
    );

    expect(result.enqueued).toBe(3);
    const enqueuedIds = evalProducer.jobs.map((job) => job.monitorId);
    expect(enqueuedIds).toEqual(expect.arrayContaining([first.id, second.id, third.id]));
    expect(enqueuedIds).not.toContain(disabled.id);

    const monitored = await dirty.filterMonitored([{ projectId, eventName: 'purchase' }]);
    expect(monitored).toEqual([{ projectId, eventName: 'purchase' }]);
  });
});
