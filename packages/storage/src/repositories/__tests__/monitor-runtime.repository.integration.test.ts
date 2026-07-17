import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { Database } from '@/client.js';
import { MonitorRuntimeRepository } from '@/repositories/monitor-runtime.repository.js';
import * as schema from '@/schema/index.js';
import { metricDefinitions, monitors, organizations, projects } from '@/schema/index.js';

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

  async function seedMonitor(overrides: { enabled?: boolean; nextEvalAt?: Date } = {}) {
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
  });
});
