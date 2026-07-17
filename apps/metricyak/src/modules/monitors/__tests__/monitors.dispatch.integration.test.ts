import path from 'node:path';
import { fileURLToPath } from 'node:url';
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
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { runMonitorDispatch } from '@/modules/monitors/monitors.dispatch.js';

const migrationsFolder = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../../../../packages/storage/migrations',
);

describe('runMonitorDispatch (integration)', () => {
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
      sql`truncate table metric_buckets, monitor_events, monitor_state, monitors, metric_definition_versions, metric_definitions, projects, organizations restart identity cascade`,
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

  it('claims and enqueues every due monitor beyond the old 500 cap, exactly once', async () => {
    const now = new Date('2026-07-13T12:00:00.000Z');
    const seeded: string[] = [];
    for (let i = 0; i < 1200; i++) {
      const [m] = await db
        .insert(monitors)
        .values({
          projectId,
          metricId,
          name: `m${i}`,
          condition: { operator: 'lt', value: 5000 },
          window: '1d',
          holdFor: '0m',
          missingData: 'zero',
          enabled: true,
          nextEvalAt: new Date(now.getTime() - 1000),
        })
        .returning();
      if (m) seeded.push(m.id);
    }

    const evalProducer = new InMemoryMonitorEvalProducer();
    const result = await runMonitorDispatch(
      { monitorRuntime: new MonitorRuntimeRepository(db), evalProducer },
      now,
    );

    expect(result.dispatched).toBe(1200);
    const enqueuedIds = evalProducer.jobs.map((j) => j.monitorId);
    expect(new Set(enqueuedIds).size).toBe(1200); // each exactly once
    expect(new Set(enqueuedIds)).toEqual(new Set(seeded));

    // all advanced → a second dispatch enqueues nothing
    const again = await runMonitorDispatch(
      { monitorRuntime: new MonitorRuntimeRepository(db), evalProducer },
      now,
    );
    expect(again.dispatched).toBe(0);
  });
});
