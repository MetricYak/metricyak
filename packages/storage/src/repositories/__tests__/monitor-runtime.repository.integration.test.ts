import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { Database } from '../../client.js';
import * as schema from '../../schema/index.js';
import { metricDefinitions, monitors, organizations, projects } from '../../schema/index.js';
import { MonitorRuntimeRepository } from '../monitor-runtime.repository.js';

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

  it('lists only enabled, due monitors ordered by next_eval_at', async () => {
    const now = new Date('2026-07-13T01:00:00.000Z');
    const due = await seedMonitor({ nextEvalAt: new Date('2026-07-13T00:30:00.000Z') });
    await seedMonitor({ enabled: false, nextEvalAt: new Date('2026-07-13T00:00:00.000Z') });
    await seedMonitor({ nextEvalAt: new Date('2026-07-13T02:00:00.000Z') }); // future

    const rows = await repo.listDueMonitors(now, 10);
    expect(rows.map((r) => r.id)).toEqual([due.id]);
  });

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
      const locked = await repo.lockDueMonitor(
        monitor.id,
        new Date('2026-07-13T01:00:00.000Z'),
        tx,
      );
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
      await repo.setNextEvalAt(monitor.id, new Date('2026-07-13T01:01:00.000Z'), tx);
    });

    expect(await repo.getState(monitor.id, '$total')).toMatchObject({ status: 'firing' });
    expect((await repo.findUnrelayedEvents(10)).length).toBe(1);
    expect(await repo.listDueMonitors(new Date('2026-07-13T01:00:30.000Z'), 10)).toEqual([]);
  });
});
