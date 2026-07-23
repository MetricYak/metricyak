import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { eq, sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { Database } from '@/client.js';
import { MonitorRuntimeRepository } from '@/repositories/monitor-runtime.repository.js';
import * as schema from '@/schema/index.js';
import { metricDefinitions, monitors, organizations, projects } from '@/schema/index.js';
import { TOTAL_SENTINEL } from '@/schema/sentinels.js';

const migrationsFolder = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../migrations',
);

describe('MonitorRuntimeRepository (integration)', () => {
  let container: StartedPostgreSqlContainer;
  let pool: Pool;
  let db: Database;
  let repo: MonitorRuntimeRepository;
  let projectId: string;
  let metricId: string;

  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgres:17-alpine').start();
    pool = new Pool({ connectionString: container.getConnectionUri() });
    db = drizzle({ client: pool, schema, casing: 'snake_case' });
    await migrate(db, { migrationsFolder });
    repo = new MonitorRuntimeRepository(db);
  }, 120_000);

  afterAll(async () => {
    await pool?.end();
    await container?.stop();
  });

  beforeEach(async () => {
    await db.execute(
      sql`truncate table monitor_events, monitor_state, monitors, metric_definitions, projects, organizations restart identity cascade`,
    );
    const [org] = await db.insert(organizations).values({ slug: 'acme', name: 'Acme' }).returning();
    if (!org) throw new Error('failed to seed organization');
    const [project] = await db
      .insert(projects)
      .values({ organizationId: org.id, name: 'Proj' })
      .returning();
    if (!project) throw new Error('failed to seed project');
    projectId = project.id;
    const [metric] = await db.insert(metricDefinitions).values({ projectId }).returning();
    if (!metric) throw new Error('failed to seed metric definition');
    metricId = metric.id;
  });

  async function seedMonitor(
    overrides: {
      enabled?: boolean;
      nextEvalAt?: Date;
      missingData?: 'skip' | 'zero' | 'fire';
    } = {},
  ) {
    const [monitor] = await db
      .insert(monitors)
      .values({
        projectId,
        metricId,
        name: 'Revenue floor',
        condition: { operator: 'lt', value: 5000 },
        window: '1d',
        holdFor: '0m',
        enabled: overrides.enabled ?? true,
        missingData: overrides.missingData ?? 'zero',
        nextEvalAt: overrides.nextEvalAt ?? new Date('2026-07-13T00:00:00.000Z'),
      })
      .returning();
    if (!monitor) throw new Error('failed to seed monitor');
    return monitor;
  }

  it('upserts state and reads it back', async () => {
    const monitor = await seedMonitor();
    await repo.upsertState({
      monitorId: monitor.id,
      series: '$total',
      status: 'pending',
      breachedSince: new Date('2026-07-13T00:00:00.000Z'),
      lastValue: 4000,
      lastEvaluatedAt: new Date('2026-07-13T00:00:00.000Z'),
    });
    await repo.upsertState({
      monitorId: monitor.id,
      series: '$total',
      status: 'firing',
      breachedSince: new Date('2026-07-13T00:00:00.000Z'),
      lastValue: 3000,
      lastEvaluatedAt: new Date('2026-07-13T00:01:00.000Z'),
    });

    const state = await repo.getState(monitor.id, '$total');
    expect(state).toMatchObject({ status: 'firing', lastValue: 3000 });
  });

  it('inserts an event and relays it exactly once', async () => {
    const monitor = await seedMonitor();
    const id = await repo.insertEvent({
      monitorId: monitor.id,
      series: '$total',
      type: 'fired',
      value: 3000,
      threshold: { operator: 'lt', value: 5000 },
      occurredAt: new Date('2026-07-13T00:01:00.000Z'),
    });

    const unrelayed = await repo.findUnrelayedEvents(10);
    expect(unrelayed.map((e) => e.id)).toEqual([id]);

    await repo.markRelayed([id], new Date('2026-07-13T00:02:00.000Z'));
    expect(await repo.findUnrelayedEvents(10)).toEqual([]);
  });

  it('commits state + event atomically inside a caller transaction', async () => {
    const monitor = await seedMonitor();
    await db.transaction(async (tx) => {
      const locked = await repo.lockMonitorForEval(monitor.id, tx);
      expect(locked?.id).toBe(monitor.id);
      await repo.upsertState(
        {
          monitorId: monitor.id,
          series: '$total',
          status: 'firing',
          breachedSince: new Date('2026-07-13T01:00:00.000Z'),
          lastValue: 3000,
          lastEvaluatedAt: new Date('2026-07-13T01:00:00.000Z'),
        },
        tx,
      );
      await repo.insertEvent(
        {
          monitorId: monitor.id,
          series: '$total',
          type: 'fired',
          value: 3000,
          threshold: { operator: 'lt', value: 5000 },
          occurredAt: new Date('2026-07-13T01:00:00.000Z'),
        },
        tx,
      );
    });

    expect(await repo.getState(monitor.id, '$total')).toMatchObject({ status: 'firing' });
    expect((await repo.findUnrelayedEvents(10)).length).toBe(1);
  });

  it('defaults new monitors to healthy', async () => {
    const [monitor] = await db
      .insert(monitors)
      .values({
        projectId,
        metricId,
        name: 'health-defaults',
        condition: { operator: 'gt', value: 1 },
        window: '1d',
        holdFor: '0m',
      })
      .returning();
    if (!monitor) throw new Error('seed monitor');
    expect(monitor.consecutiveFailures).toBe(0);
    expect(monitor.evalHealth).toBe('ok');
    expect(monitor.lastEvalError).toBeNull();
    expect(monitor.lastEvalErrorAt).toBeNull();
  });

  describe('claimDueMonitors', () => {
    it('advances next_eval_at atomically and returns only due, enabled monitors', async () => {
      const now = new Date('2026-07-13T12:00:00.000Z');
      const due = await seedMonitor({ enabled: true, nextEvalAt: new Date(now.getTime() - 1000) });
      const future = await seedMonitor({
        enabled: true,
        nextEvalAt: new Date(now.getTime() + 60_000),
      });
      const disabled = await seedMonitor({
        enabled: false,
        nextEvalAt: new Date(now.getTime() - 1000),
      });

      const claimed = await repo.claimDueMonitors(now, 60_000, 100);

      expect(claimed.map((m) => m.id)).toEqual([due.id]);
      const rows = await db.select().from(monitors);
      const dueRow = rows.find((r) => r.id === due.id);
      const futureRow = rows.find((r) => r.id === future.id);
      const disabledRow = rows.find((r) => r.id === disabled.id);
      expect(dueRow?.nextEvalAt.toISOString()).toBe(new Date(now.getTime() + 60_000).toISOString());
      expect(futureRow?.nextEvalAt.toISOString()).toBe(
        new Date(now.getTime() + 60_000).toISOString(),
      ); // untouched (was already +60s)
      expect(disabledRow?.nextEvalAt.getTime()).toBe(now.getTime() - 1000); // untouched
    });

    it('two concurrent claims partition the due set with no overlap', async () => {
      const now = new Date('2026-07-13T12:00:00.000Z');
      const ids = new Set<string>();
      for (let i = 0; i < 20; i++) {
        const m = await seedMonitor({ enabled: true, nextEvalAt: new Date(now.getTime() - 1000) });
        ids.add(m.id);
      }
      const [a, b] = await Promise.all([
        repo.claimDueMonitors(now, 60_000, 20),
        repo.claimDueMonitors(now, 60_000, 20),
      ]);
      const all = [...a, ...b].map((m) => m.id);
      expect(new Set(all).size).toBe(all.length); // no monitor claimed twice
      expect(all.filter((id) => ids.has(id)).length).toBe(20); // every due monitor claimed exactly once
    });

    it('claims only time-sensitive monitors (fire/zero or pending/firing)', async () => {
      const now = new Date('2026-07-13T12:00:00.000Z');
      const nextEvalAt = new Date(now.getTime() - 1000);

      const skipOk = await seedMonitor({ missingData: 'skip', nextEvalAt });
      const fireMissing = await seedMonitor({ missingData: 'fire', nextEvalAt });
      const firing = await seedMonitor({ missingData: 'skip', nextEvalAt });
      const pending = await seedMonitor({ missingData: 'skip', nextEvalAt });

      await repo.upsertState({
        monitorId: firing.id,
        series: TOTAL_SENTINEL,
        status: 'firing',
        breachedSince: now,
        lastValue: 1,
        lastEvaluatedAt: now,
      });
      await repo.upsertState({
        monitorId: pending.id,
        series: TOTAL_SENTINEL,
        status: 'pending',
        breachedSince: now,
        lastValue: 1,
        lastEvaluatedAt: now,
      });

      const claimed = await repo.claimDueMonitors(now, 60_000, 100);
      const ids = new Set(claimed.map((m) => m.id));

      expect(ids.has(skipOk.id)).toBe(false);
      expect(ids.has(fireMissing.id)).toBe(true);
      expect(ids.has(firing.id)).toBe(true);
      expect(ids.has(pending.id)).toBe(true);
    });
  });

  it('increments the failure counter without tripping below the threshold', async () => {
    const now = new Date('2026-07-17T00:00:00.000Z');
    const [m] = await db
      .insert(monitors)
      .values({
        projectId,
        metricId,
        name: 'fail-1',
        condition: { operator: 'gt', value: 1 },
        window: '1d',
        holdFor: '0m',
      })
      .returning();
    if (!m) throw new Error('seed');

    await repo.recordEvalFailure(m.id, 'boom', now);

    const [after] = await db.select().from(monitors).where(eq(monitors.id, m.id));
    expect(after?.consecutiveFailures).toBe(1);
    expect(after?.evalHealth).toBe('ok');
    expect(after?.lastEvalError).toBe('boom');
    // next_eval_at is NOT pushed out below the threshold
    expect(after?.nextEvalAt.getTime()).toBe(m.nextEvalAt.getTime());
  });

  it('trips to error and backs off at the threshold', async () => {
    const now = new Date('2026-07-17T00:00:00.000Z');
    const [m] = await db
      .insert(monitors)
      .values({
        projectId,
        metricId,
        name: 'fail-K',
        condition: { operator: 'gt', value: 1 },
        window: '1d',
        holdFor: '0m',
      })
      .returning();
    if (!m) throw new Error('seed');

    await repo.recordEvalFailure(m.id, 'e1', now);
    await repo.recordEvalFailure(m.id, 'e2', now);
    await repo.recordEvalFailure(m.id, 'e3', now); // == K (3)

    const [after] = await db.select().from(monitors).where(eq(monitors.id, m.id));
    expect(after?.consecutiveFailures).toBe(3);
    expect(after?.evalHealth).toBe('error');
    expect(after?.lastEvalError).toBe('e3');
    // backed off by the base interval (60s) at exactly K
    expect(after?.nextEvalAt.getTime()).toBe(now.getTime() + 60_000);
  });

  it('resets health on success', async () => {
    const [m] = await db
      .insert(monitors)
      .values({
        projectId,
        metricId,
        name: 'reset',
        evalHealth: 'error',
        consecutiveFailures: 5,
        lastEvalError: 'old',
        condition: { operator: 'gt', value: 1 },
        window: '1d',
        holdFor: '0m',
      })
      .returning();
    if (!m) throw new Error('seed');

    await repo.resetEvalHealth(m.id);

    const [after] = await db.select().from(monitors).where(eq(monitors.id, m.id));
    expect(after?.consecutiveFailures).toBe(0);
    expect(after?.evalHealth).toBe('ok');
    expect(after?.lastEvalError).toBeNull();
    expect(after?.lastEvalErrorAt).toBeNull();
  });

  it('reads last successful eval time for the total series', async () => {
    const at = new Date('2026-07-17T01:02:03.000Z');
    const [m] = await db
      .insert(monitors)
      .values({
        projectId,
        metricId,
        name: 'staleness',
        condition: { operator: 'gt', value: 1 },
        window: '1d',
        holdFor: '0m',
      })
      .returning();
    if (!m) throw new Error('seed');
    await repo.upsertState({
      monitorId: m.id,
      series: TOTAL_SENTINEL,
      status: 'ok',
      breachedSince: null,
      lastValue: 4,
      lastEvaluatedAt: at,
    });

    const map = await repo.getLastEvaluatedAt([m.id]);
    expect(map.get(m.id)?.getTime()).toBe(at.getTime());
    expect((await repo.getLastEvaluatedAt([])).size).toBe(0);
  });

  it('ignores a stale failure whose slot predates a newer successful eval', async () => {
    // A later slot succeeded (stamping last_evaluated_at) before an earlier
    // slot's out-of-band failure recording obtained the row lock. The stale
    // failure must not be counted against the already-recovered monitor.
    const failedAt = new Date('2026-07-17T00:00:00.000Z');
    const succeededAt = new Date('2026-07-17T00:01:00.000Z');
    const m = await seedMonitor();
    await repo.upsertState({
      monitorId: m.id,
      series: TOTAL_SENTINEL,
      status: 'ok',
      breachedSince: null,
      lastValue: 1,
      lastEvaluatedAt: succeededAt,
    });

    await repo.recordEvalFailure(m.id, 'stale failure', failedAt);

    const [after] = await db.select().from(monitors).where(eq(monitors.id, m.id));
    expect(after?.consecutiveFailures).toBe(0);
    expect(after?.evalHealth).toBe('ok');
    expect(after?.lastEvalError).toBeNull();
  });

  it('still records a failure newer than the last successful eval', async () => {
    // The freshness guard must only drop stale failures — a failure whose slot
    // is newer than the last success is legitimate and must still count.
    const succeededAt = new Date('2026-07-17T00:00:00.000Z');
    const failedAt = new Date('2026-07-17T00:01:00.000Z');
    const m = await seedMonitor();
    await repo.upsertState({
      monitorId: m.id,
      series: TOTAL_SENTINEL,
      status: 'ok',
      breachedSince: null,
      lastValue: 1,
      lastEvaluatedAt: succeededAt,
    });

    await repo.recordEvalFailure(m.id, 'real failure', failedAt);

    const [after] = await db.select().from(monitors).where(eq(monitors.id, m.id));
    expect(after?.consecutiveFailures).toBe(1);
    expect(after?.lastEvalError).toBe('real failure');
  });
});
