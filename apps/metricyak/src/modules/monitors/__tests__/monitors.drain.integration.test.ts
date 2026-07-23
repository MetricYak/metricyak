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
import { runMonitorDrain } from '@/modules/monitors/monitors.drain.js';

const migrationsFolder = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../../../../packages/storage/migrations',
);

describe('runMonitorDrain (integration)', () => {
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

  it('enqueues eval for enabled monitors whose keys match popped dirty keys', async () => {
    const dirty = new InMemoryMonitorDirtyBuffer();
    const keysRepo = new MonitorEventKeysRepository(db);
    const evalProducer = new InMemoryMonitorEvalProducer();

    const m = await new MonitorsRepository(db).create({
      projectId,
      metricId,
      name: 'm',
      condition: { operator: 'gt', value: 1 },
      window: '1h',
      holdFor: '0m',
      enabled: true,
    });
    await keysRepo.sync(m.id, projectId, ['purchase']);
    await dirty.markDirty([{ projectId, eventName: 'purchase' }], new Date('2026-07-22T00:00:00Z'));

    const result = await runMonitorDrain(
      { dirty, monitorEventKeys: keysRepo, evalProducer },
      new Date('2026-07-22T00:00:10Z'),
    );

    expect(result.enqueued).toBe(1);
    expect(evalProducer.jobs.map((j) => j.monitorId)).toEqual([m.id]);
  });

  it('returns zero enqueued when no dirty keys are due', async () => {
    const dirty = new InMemoryMonitorDirtyBuffer();
    const keysRepo = new MonitorEventKeysRepository(db);
    const evalProducer = new InMemoryMonitorEvalProducer();

    const result = await runMonitorDrain(
      { dirty, monitorEventKeys: keysRepo, evalProducer },
      new Date('2026-07-22T00:00:10Z'),
    );

    expect(result.enqueued).toBe(0);
    expect(evalProducer.jobs).toEqual([]);
  });

  it('does not enqueue disabled monitors even if their keys are dirty', async () => {
    const dirty = new InMemoryMonitorDirtyBuffer();
    const keysRepo = new MonitorEventKeysRepository(db);
    const evalProducer = new InMemoryMonitorEvalProducer();

    const disabled = await new MonitorsRepository(db).create({
      projectId,
      metricId,
      name: 'off',
      condition: { operator: 'gt', value: 1 },
      window: '1h',
      holdFor: '0m',
      enabled: false,
    });
    await keysRepo.sync(disabled.id, projectId, ['purchase']);
    await dirty.markDirty([{ projectId, eventName: 'purchase' }], new Date('2026-07-22T00:00:00Z'));

    const result = await runMonitorDrain(
      { dirty, monitorEventKeys: keysRepo, evalProducer },
      new Date('2026-07-22T00:00:10Z'),
    );

    expect(result.enqueued).toBe(0);
    expect(evalProducer.jobs).toEqual([]);
  });
});
