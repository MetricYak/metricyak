import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClickHouseClient, type ClickHouseClient, migrate as migrateClickHouse } from '@metricyak/clickhouse';
import {
  type Database,
  MetricsRepository,
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
import {
  evaluateMonitorRecord,
  type MonitorEvalCoreDeps,
  processMonitorEvalJob,
} from '@/modules/monitors/monitors.eval.js';

const migrationsFolder = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../../../../packages/storage/migrations',
);

describe('evaluateMonitorRecord (integration)', () => {
  let container: StartedPostgreSqlContainer;
  let pool: Pool;
  let db: Database;
  let chContainer: StartedTestContainer;
  let chClient: ClickHouseClient;
  let deps: MonitorEvalCoreDeps;
  let projectId: string;
  let monitorId: string;

  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgres:17-alpine').start();
    pool = new Pool({ connectionString: container.getConnectionUri() });
    db = drizzle({ client: pool, schema, casing: 'snake_case' });
    await migrate(db, { migrationsFolder });

    chContainer = await new GenericContainer('clickhouse/clickhouse-server:24.8')
      .withExposedPorts(8123)
      .withEnvironment({ CLICKHOUSE_USER: 'test', CLICKHOUSE_PASSWORD: 'test', CLICKHOUSE_DB: 'test' })
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
      metricReads: createMetricReads({ aggregates: createClickHouseReadsAggregates(chClient) }),
      monitorRuntime: new MonitorRuntimeRepository(db),
    };
  });

  /**
   * Creates a metric definition in a fresh project and returns its id. Used to simulate a
   * "missing" metric for a monitor: the row exists (satisfying the FK on monitors.metric_id)
   * but getDefinition(id, projectId) filters by project, so it resolves to null.
   */
  async function createMetricInOtherProject(): Promise<string> {
    const [otherOrg] = await db
      .insert(organizations)
      .values({ slug: `other-${Date.now()}-${Math.random()}`, name: 'Other' })
      .returning();
    if (!otherOrg) throw new Error('seed other org');
    const [otherProject] = await db
      .insert(projects)
      .values({ organizationId: otherOrg.id, name: 'Other Proj' })
      .returning();
    if (!otherProject) throw new Error('seed other project');
    const metrics = new MetricsRepository(db);
    const metric = await metrics.create({
      projectId: otherProject.id,
      name: 'Other metric',
      definition: {
        events: [{ key: 'other', source: 'other', type: 'other', aggregation: 'count' }],
      },
    });
    return metric.id;
  }

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

    it('resets eval health after a successful evaluation', async () => {
      const { runMonitorEval } = await import('@/modules/monitors/monitors.eval.js');
      // put the monitor into an error state first
      await db
        .update(monitors)
        .set({ evalHealth: 'error', consecutiveFailures: 4, lastEvalError: 'stale' })
        .where(eq(monitors.id, monitorId));

      await runMonitorEval({ ...deps, db }, monitorId, new Date());

      const [after] = await db.select().from(monitors).where(eq(monitors.id, monitorId));
      expect(after?.evalHealth).toBe('ok');
      expect(after?.consecutiveFailures).toBe(0);
      expect(after?.lastEvalError).toBeNull();
    });

    it('throws when the watched metric is missing (so it counts as a failure)', async () => {
      const { runMonitorEval } = await import('@/modules/monitors/monitors.eval.js');
      // The FK on monitors.metric_id -> metric_definitions.id means we can't point at a
      // nonexistent id directly; instead point at a metric that exists but belongs to a
      // different project, which getDefinition(id, projectId) treats as "not found".
      const orphanMetricId = await createMetricInOtherProject();
      await db.update(monitors).set({ metricId: orphanMetricId }).where(eq(monitors.id, monitorId));

      await expect(runMonitorEval({ ...deps, db }, monitorId, new Date())).rejects.toThrow(
        /metric/i,
      );
    });

    it('records a failure and trips to error after K failed slots via the worker wrapper', async () => {
      const orphanMetricId = await createMetricInOtherProject();
      await db.update(monitors).set({ metricId: orphanMetricId }).where(eq(monitors.id, monitorId));
      const now = new Date('2026-07-17T00:00:00.000Z');

      for (let i = 0; i < 3; i++) {
        await expect(processMonitorEvalJob({ ...deps, db }, monitorId, now)).rejects.toThrow();
      }

      const [after] = await db.select().from(monitors).where(eq(monitors.id, monitorId));
      expect(after?.consecutiveFailures).toBe(3);
      expect(after?.evalHealth).toBe('error');
      expect(after?.nextEvalAt.getTime()).toBe(now.getTime() + 60_000);
    });

    it('a global DB outage during failure recording produces no false incident', async () => {
      // The eval itself fails for a monitor-specific reason (missing metric)...
      const orphanMetricId = await createMetricInOtherProject();
      await db.update(monitors).set({ metricId: orphanMetricId }).where(eq(monitors.id, monitorId));
      const now = new Date('2026-07-17T00:00:00.000Z');

      // ...and the out-of-band recordEvalFailure write itself fails too, simulating a
      // global DB outage (the same outage that would have broken the eval read/write).
      const failingRuntime = Object.assign(
        Object.create(Object.getPrototypeOf(deps.monitorRuntime)),
        deps.monitorRuntime,
        {
          recordEvalFailure: async () => {
            throw new Error('db down');
          },
        },
      );

      // The ORIGINAL eval error must propagate, not the recording failure.
      await expect(
        processMonitorEvalJob({ ...deps, db, monitorRuntime: failingRuntime }, monitorId, now),
      ).rejects.toThrow(/metric unavailable/i);

      // Because the recording write itself failed, the counter must not advance —
      // otherwise a global outage would masquerade as a per-monitor incident.
      const [after] = await db.select().from(monitors).where(eq(monitors.id, monitorId));
      expect(after?.consecutiveFailures).toBe(0);
      expect(after?.evalHealth).toBe('ok');
    });

    it('recovery resets health without stranding the monitor on the long backoff cadence', async () => {
      const { runMonitorEval } = await import('@/modules/monitors/monitors.eval.js');
      const farFuture = new Date('2026-08-01T00:00:00.000Z');
      await db
        .update(monitors)
        .set({
          evalHealth: 'error',
          consecutiveFailures: 4,
          lastEvalError: 'stale',
          nextEvalAt: farFuture,
        })
        .where(eq(monitors.id, monitorId));

      await runMonitorEval({ ...deps, db }, monitorId, new Date());

      const [after] = await db.select().from(monitors).where(eq(monitors.id, monitorId));
      expect(after?.evalHealth).toBe('ok');
      expect(after?.consecutiveFailures).toBe(0);
      // Reset must not touch next_eval_at — cadence is the dispatcher's job (it already
      // advanced it by 60s on claim), so the monitor must not stay stuck on the backoff.
      expect(after?.nextEvalAt.toISOString()).toBe(farFuture.toISOString());
    });
  });
});
