import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MetricsRepository, MonitorsRepository, organizations, projects } from '@metricyak/storage';
import * as schema from '@metricyak/storage/schema';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { sql } from 'drizzle-orm';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { MonitorEventKeysRepository } from '@/repositories/monitor-event-keys.repository.js';

const migrationsFolder = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../migrations',
);

describe('MonitorEventKeysRepository (integration)', () => {
  let container: StartedPostgreSqlContainer;
  let pool: Pool;
  let db: NodePgDatabase<typeof schema>;
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
      sql`truncate table monitor_event_keys, monitors, metric_definition_versions, metric_definitions, projects, organizations restart identity cascade`,
    );
    const [org] = await db.insert(organizations).values({ slug: 'acme', name: 'Acme' }).returning();
    const [project] = await db
      .insert(projects)
      .values({ organizationId: org?.id ?? '', name: 'Proj' })
      .returning();
    projectId = project?.id ?? '';
    const metric = await new MetricsRepository(db).create({
      projectId,
      name: 'Purchases',
      definition: {
        events: [{ key: 'purchase', source: 'purchase', type: 'purchase', aggregation: 'count' }],
      },
    });
    metricId = metric.id;
  });

  it('resolves only enabled monitors whose keys match the event names', async () => {
    const repo = new MonitorEventKeysRepository(db);
    const monitorsRepo = new MonitorsRepository(db);

    const enabled = await monitorsRepo.create({
      projectId,
      metricId,
      name: 'on',
      condition: { operator: 'gt', value: 1 },
      window: '1h',
      holdFor: '0m',
      enabled: true,
    });
    const disabled = await monitorsRepo.create({
      projectId,
      metricId,
      name: 'off',
      condition: { operator: 'gt', value: 1 },
      window: '1h',
      holdFor: '0m',
      enabled: false,
    });
    await repo.sync(enabled.id, projectId, ['purchase', 'checkout']);
    await repo.sync(disabled.id, projectId, ['purchase']);

    const hit = await repo.resolveEnabledMonitorIds(projectId, ['purchase']);
    expect(hit).toEqual([enabled.id]);

    const miss = await repo.resolveEnabledMonitorIds(projectId, ['signup']);
    expect(miss).toEqual([]);
  });

  it('sync replaces prior rows; distinctKeys reflects current rows', async () => {
    const repo = new MonitorEventKeysRepository(db);
    const m = await new MonitorsRepository(db).create({
      projectId,
      metricId,
      name: 'm',
      condition: { operator: 'gt', value: 1 },
      window: '1h',
      holdFor: '0m',
      enabled: true,
    });
    await repo.sync(m.id, projectId, ['a', 'b']);
    await repo.sync(m.id, projectId, ['b', 'c']);

    const keys = (await repo.distinctKeysAfter(null, 100)).map((k) => k.eventName).sort();
    expect(keys).toEqual(['b', 'c']);
  });
});
