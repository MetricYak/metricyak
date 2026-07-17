import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  AggregatesRepository,
  type Database,
  MetricsRepository,
  MonitorRuntimeRepository,
  TOTAL_SENTINEL,
  metricBuckets,
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
import { createMetricReads } from '@/modules/aggregates/aggregates.reads.js';
import { evaluateMonitorRecord, type MonitorEvalCoreDeps } from '@/modules/monitors/monitors.eval.js';

const migrationsFolder = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../../../../packages/storage/migrations',
);

describe('evaluateMonitorRecord (integration)', () => {
  let container: StartedPostgreSqlContainer;
  let pool: Pool;
  let db: Database;
  let deps: MonitorEvalCoreDeps;
  let projectId: string;
  let monitorId: string;

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
    await db.insert(metricBuckets).values({
      metricId: metric.id,
      metricVersion: metric.version,
      granularity: 'minute',
      bucketStart: new Date('2026-07-13T11:00:00.000Z'),
      seriesKey: 'purchase',
      dimName: '$total',
      dimValue: '$total',
      count: 3000,
    });
    const [monitor] = await db
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
    if (!monitor) throw new Error('seed monitor');
    monitorId = monitor.id;

    deps = {
      metrics,
      metricReads: createMetricReads({ aggregates: new AggregatesRepository(db) }),
      monitorRuntime: new MonitorRuntimeRepository(db),
    };
  });

  it('fires on cross and does NOT touch next_eval_at', async () => {
    const now = new Date('2026-07-13T12:00:00.000Z');
    const [before] = await db.select().from(monitors);

    const outcome = await db.transaction((tx) => {
      const [locked] = [before];
      if (!locked) throw new Error('no monitor');
      return evaluateMonitorRecord(deps, locked, now, tx);
    });

    expect(outcome).toBe('fired');
    const state = await deps.monitorRuntime.getState(monitorId, TOTAL_SENTINEL);
    expect(state?.status).toBe('firing');
    const [after] = await db.select().from(monitors);
    expect(after?.nextEvalAt.toISOString()).toBe(before?.nextEvalAt.toISOString()); // core never advances
  });

  describe('runMonitorEval (worker wrapper)', () => {
    it('is idempotent: two concurrent evals of the same monitor fire at most once', async () => {
      const { runMonitorEval } = await import('@/modules/monitors/monitors.eval.js');
      const now = new Date('2026-07-13T12:00:00.000Z');
      const evalDeps = { ...deps, db };

      const [a, b] = await Promise.all([
        runMonitorEval(evalDeps, monitorId, now),
        runMonitorEval(evalDeps, monitorId, now),
      ]);

      const firedCount = [a, b].filter((o) => o === 'fired').length;
      expect(firedCount).toBe(1); // row lock serializes; second sees 'firing', no re-fire
      const events = await db.select().from(schema.monitorEvents);
      expect(events).toHaveLength(1);
    });

    it("returns 'skipped' for a disabled monitor", async () => {
      const { runMonitorEval } = await import('@/modules/monitors/monitors.eval.js');
      await db.update(monitors).set({ enabled: false }).where(sql`${monitors.id} = ${monitorId}`);
      const outcome = await runMonitorEval(
        { ...deps, db },
        monitorId,
        new Date('2026-07-13T12:00:00.000Z'),
      );
      expect(outcome).toBe('skipped');
    });
  });
});
