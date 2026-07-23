import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ClickHouseClient } from '@metricyak/clickhouse';
import {
  InMemoryEventsProducer,
  InMemoryMonitorDirtyBuffer,
  InMemoryMonitorEvalProducer,
  InMemoryMonitorSignalsProducer,
} from '@metricyak/queue';
import { type Database, MetricsRepository, organizations, projects } from '@metricyak/storage';
import * as schema from '@metricyak/storage/schema';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { eq, sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '@/app.js';
import { createContainer } from '@/container/container.js';

const migrationsFolder = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../../../../packages/storage/migrations',
);

describe('monitor_event_keys sync (integration)', () => {
  let container: StartedPostgreSqlContainer;
  let pool: Pool;
  let db: Database;
  let app: ReturnType<typeof createApp>;
  let projectId: string;
  let purchaseMetricId: string;
  let refundMetricId: string;

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
    const purchaseMetric = await metrics.create({
      projectId,
      name: 'Purchases',
      definition: {
        events: [{ key: 'purchase', source: 'purchase', type: 'purchase', aggregation: 'count' }],
      },
    });
    purchaseMetricId = purchaseMetric.id;

    const refundMetric = await metrics.create({
      projectId,
      name: 'Refunds',
      definition: {
        events: [{ key: 'refund', source: 'refund', type: 'refund', aggregation: 'count' }],
      },
    });
    refundMetricId = refundMetric.id;

    app = createApp(
      createContainer(
        db,
        new InMemoryEventsProducer(),
        new InMemoryMonitorSignalsProducer(),
        new InMemoryMonitorEvalProducer(),
        {} as ClickHouseClient,
        new InMemoryMonitorDirtyBuffer(),
      ),
    );
  }, 120_000);

  it('populates monitor_event_keys on create and replaces them on metric change', async () => {
    const res = await app.request(`/v1/projects/${projectId}/monitors`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        metricId: purchaseMetricId,
        name: 'm',
        condition: { operator: 'gt', value: 1 },
        window: '1h',
        holdFor: '0m',
      }),
    });
    expect(res.status).toBe(201);
    const created = (await res.json()) as { monitorId: string };

    const rowsAfterCreate = await db
      .select()
      .from(schema.monitorEventKeys)
      .where(eq(schema.monitorEventKeys.monitorId, created.monitorId));
    expect(rowsAfterCreate.map((row) => row.eventName)).toEqual(['purchase']);

    const patchRes = await app.request(`/v1/projects/${projectId}/monitors/${created.monitorId}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ metricId: refundMetricId }),
    });
    expect(patchRes.status).toBe(200);

    const rowsAfterUpdate = await db
      .select()
      .from(schema.monitorEventKeys)
      .where(eq(schema.monitorEventKeys.monitorId, created.monitorId));
    expect(rowsAfterUpdate.map((row) => row.eventName)).toEqual(['refund']);
  });
});
