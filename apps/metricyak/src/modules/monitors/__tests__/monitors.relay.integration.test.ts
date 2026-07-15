import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  InMemoryMonitorSignalsProducer,
  type MonitorSignalJob,
  type MonitorSignalsProducer,
} from '@metricyak/queue';
import {
  type Database,
  MonitorRuntimeRepository,
  metricDefinitions,
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
import { relayMonitorSignals } from '@/modules/monitors/monitors.relay.js';

const migrationsFolder = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../../../../packages/storage/migrations',
);

describe('relayMonitorSignals (integration)', () => {
  let container: StartedPostgreSqlContainer;
  let pool: Pool;
  let db: Database;
  let monitorRuntime: MonitorRuntimeRepository;
  let monitorId: string;

  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgres:17-alpine').start();
    pool = new Pool({ connectionString: container.getConnectionUri() });
    db = drizzle({ client: pool, schema, casing: 'snake_case' });
    await migrate(db, { migrationsFolder });
    monitorRuntime = new MonitorRuntimeRepository(db);
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
    const [metric] = await db
      .insert(metricDefinitions)
      .values({ projectId: project.id })
      .returning();
    if (!metric) throw new Error('failed to seed metric definition');
    const [monitor] = await db
      .insert(monitors)
      .values({
        projectId: project.id,
        metricId: metric.id,
        name: 'Revenue floor',
        condition: { operator: 'lt', value: 5000 },
        window: '1d',
        holdFor: '0m',
        enabled: true,
        nextEvalAt: new Date('2026-07-13T00:00:00.000Z'),
      })
      .returning();
    if (!monitor) throw new Error('failed to seed monitor');
    monitorId = monitor.id;
  });

  it('enqueues each unrelayed event once with jobId=eventId and marks them relayed', async () => {
    const id1 = await monitorRuntime.insertEvent({
      monitorId,
      series: '$total',
      type: 'fired',
      value: 3000,
      threshold: { operator: 'lt', value: 5000 },
      occurredAt: new Date('2026-07-13T00:01:00.000Z'),
    });
    const id2 = await monitorRuntime.insertEvent({
      monitorId,
      series: '$total',
      type: 'fired',
      value: 2500,
      threshold: { operator: 'lt', value: 5000 },
      occurredAt: new Date('2026-07-13T00:02:00.000Z'),
    });

    const signals = new InMemoryMonitorSignalsProducer();
    const result = await relayMonitorSignals({ db, monitorRuntime, signals }, new Date());
    expect(result.relayed).toBe(2);
    expect(signals.jobs.map((j) => j.eventId).sort()).toEqual([id1, id2].sort());

    const again = await relayMonitorSignals({ db, monitorRuntime, signals }, new Date());
    expect(again.relayed).toBe(0);
    expect(signals.jobs.length).toBe(2);
  });

  it('durably relays earlier events when a later enqueue in the same pass fails', async () => {
    const id1 = await monitorRuntime.insertEvent({
      monitorId,
      series: '$total',
      type: 'fired',
      value: 3000,
      threshold: { operator: 'lt', value: 5000 },
      occurredAt: new Date('2026-07-13T00:01:00.000Z'),
    });
    const id2 = await monitorRuntime.insertEvent({
      monitorId,
      series: '$total',
      type: 'fired',
      value: 2500,
      threshold: { operator: 'lt', value: 5000 },
      occurredAt: new Date('2026-07-13T00:02:00.000Z'),
    });
    const id3 = await monitorRuntime.insertEvent({
      monitorId,
      series: '$total',
      type: 'fired',
      value: 2000,
      threshold: { operator: 'lt', value: 5000 },
      occurredAt: new Date('2026-07-13T00:03:00.000Z'),
    });

    class FlakyMonitorSignalsProducer implements MonitorSignalsProducer {
      readonly jobs: MonitorSignalJob[] = [];

      constructor(private readonly failOnEventId: string) {}

      async enqueue(job: MonitorSignalJob): Promise<void> {
        if (job.eventId === this.failOnEventId) {
          throw new Error('simulated enqueue failure');
        }
        this.jobs.push(job);
      }
    }

    const flaky = new FlakyMonitorSignalsProducer(id2);
    await expect(
      relayMonitorSignals({ db, monitorRuntime, signals: flaky }, new Date()),
    ).rejects.toThrow('simulated enqueue failure');

    expect(flaky.jobs.map((job) => job.eventId)).toEqual([id1]);

    const stillUnrelayed = await monitorRuntime.findUnrelayedEvents(10);
    expect(stillUnrelayed.map((event) => event.id).sort()).toEqual([id2, id3].sort());

    const recovered = new InMemoryMonitorSignalsProducer();
    const retry = await relayMonitorSignals({ db, monitorRuntime, signals: recovered }, new Date());
    expect(retry.relayed).toBe(2);
    expect(recovered.jobs.map((job) => job.eventId).sort()).toEqual([id2, id3].sort());
  });
});
