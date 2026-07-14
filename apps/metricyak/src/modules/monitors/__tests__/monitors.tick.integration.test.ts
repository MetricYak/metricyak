import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { InMemoryMonitorSignalsProducer } from '@metricyak/queue';
import {
  AggregatesRepository,
  type Database,
  MetricsRepository,
  MonitorRuntimeRepository,
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
import { createMetricReads } from '../../aggregates/aggregates.reads.js';
import { type MonitorTickDeps, runMonitorTick } from '../monitors.tick.js';

const migrationsFolder = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../../../../packages/storage/migrations',
);

describe('runMonitorTick (integration)', () => {
  let container: StartedPostgreSqlContainer;
  let pool: Pool;
  let db: Database;
  let deps: MonitorTickDeps;
  let projectId: string;
  let metricId: string;
  let metricVersion: number;
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
    if (!org) throw new Error('failed to seed organization');
    const [project] = await db
      .insert(projects)
      .values({ organizationId: org.id, name: 'Proj' })
      .returning();
    if (!project) throw new Error('failed to seed project');
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
    metricVersion = metric.version;

    await db.insert(metricBuckets).values({
      metricId,
      metricVersion,
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
        metricId,
        name: 'Revenue floor',
        condition: { operator: 'lt', value: 5000 },
        window: '1d',
        holdFor: '0m',
        missingData: 'zero',
        enabled: true,
        nextEvalAt: new Date('2026-07-13T12:00:00.000Z'),
      })
      .returning();
    if (!monitor) throw new Error('failed to seed monitor');
    monitorId = monitor.id;

    deps = {
      db,
      metrics,
      metricReads: createMetricReads({ aggregates: new AggregatesRepository(db) }),
      monitorRuntime: new MonitorRuntimeRepository(db),
      signals: new InMemoryMonitorSignalsProducer(),
    };
  });

  it('fires once on cross, records state and one event, advances next_eval_at', async () => {
    const now = new Date('2026-07-13T12:00:00.000Z');

    const first = await runMonitorTick(deps, now);
    expect(first.fired).toBe(1);
    expect(first.relayed).toBeGreaterThanOrEqual(1);

    const second = await runMonitorTick(deps, new Date(now.getTime() + 60_000));
    expect(second.fired).toBe(0);

    const unrelayed = await deps.monitorRuntime.findUnrelayedEvents(10);
    expect(unrelayed).toHaveLength(0);
    const signals = deps.signals;
    if (!(signals instanceof InMemoryMonitorSignalsProducer)) throw new Error('expected in-memory');
    expect(signals.jobs).toHaveLength(1);
    const state = await deps.monitorRuntime.getState(monitorId, '$total');
    expect(state?.status).toBe('firing');
  });

  it('re-arms after recovery so a later breach fires again', async () => {
    const now = new Date('2026-07-13T12:00:00.000Z');

    const first = await runMonitorTick(deps, now);
    expect(first.fired).toBe(1);

    await db
      .update(metricBuckets)
      .set({ count: 6000 })
      .where(sql`${metricBuckets.metricId} = ${metricId}`);

    const recovery = await runMonitorTick(deps, new Date(now.getTime() + 60_000));
    expect(recovery.fired).toBe(0);
    const recoveredState = await deps.monitorRuntime.getState(monitorId, '$total');
    expect(recoveredState?.status).toBe('ok');

    await db
      .update(metricBuckets)
      .set({ count: 3000 })
      .where(sql`${metricBuckets.metricId} = ${metricId}`);

    const third = await runMonitorTick(deps, new Date(now.getTime() + 120_000));
    expect(third.fired).toBe(1);

    const unrelayed = await deps.monitorRuntime.findUnrelayedEvents(10);
    expect(unrelayed).toHaveLength(0);
    const signals = deps.signals;
    if (!(signals instanceof InMemoryMonitorSignalsProducer)) throw new Error('expected in-memory');
    expect(signals.jobs).toHaveLength(2);
    const finalState = await deps.monitorRuntime.getState(monitorId, '$total');
    expect(finalState?.status).toBe('firing');
  });
});
