import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { Database } from '@/client.js';
import { MonitorsRepository } from '@/repositories/monitors.repository.js';
import * as schema from '@/schema/index.js';
import { metricDefinitions, organizations, projects } from '@/schema/index.js';

const migrationsFolder = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../migrations',
);

describe('MonitorsRepository (integration)', () => {
  let container: StartedPostgreSqlContainer;
  let pool: Pool;
  let db: Database;
  let monitors: MonitorsRepository;
  let projectId: string;
  let otherProjectId: string;
  let metricId: string;

  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgres:17-alpine').start();
    pool = new Pool({ connectionString: container.getConnectionUri() });
    db = drizzle({ client: pool, schema, casing: 'snake_case' });
    await migrate(db, { migrationsFolder });
    monitors = new MonitorsRepository(db);
  }, 120_000);

  afterAll(async () => {
    await pool?.end();
    await container?.stop();
  });

  beforeEach(async () => {
    await db.execute(
      sql`truncate table monitors, metric_definitions, projects, organizations restart identity cascade`,
    );
    const [org] = await db.insert(organizations).values({ slug: 'acme', name: 'Acme' }).returning();
    if (!org) throw new Error('failed to seed organization');
    const [project] = await db
      .insert(projects)
      .values({ organizationId: org.id, name: 'Proj' })
      .returning();
    if (!project) throw new Error('failed to seed project');
    projectId = project.id;
    const [otherProject] = await db
      .insert(projects)
      .values({ organizationId: org.id, name: 'Other' })
      .returning();
    if (!otherProject) throw new Error('failed to seed other project');
    otherProjectId = otherProject.id;
    const [metric] = await db.insert(metricDefinitions).values({ projectId }).returning();
    if (!metric) throw new Error('failed to seed metric definition');
    metricId = metric.id;
  });

  function newMonitorInput() {
    return {
      projectId,
      metricId,
      name: 'Revenue floor',
      condition: { operator: 'lt' as const, value: 5000 },
      window: '1d',
      holdFor: '0m',
    };
  }

  it('creates a monitor with lifecycle defaults', async () => {
    const record = await monitors.create(newMonitorInput());

    expect(record.enabled).toBe(true);
    expect(record.missingData).toBe('skip');
    expect(record.scope).toBeNull();
    expect(record.description).toBeNull();
    expect(record.nextEvalAt).toBeInstanceOf(Date);
    expect(record.condition).toEqual({ operator: 'lt', value: 5000 });
  });

  it('persists explicit enabled and missingData', async () => {
    const record = await monitors.create({
      ...newMonitorInput(),
      enabled: false,
      missingData: 'fire',
    });

    expect(record.enabled).toBe(false);
    expect(record.missingData).toBe('fire');
  });

  it('lists only monitors belonging to the project', async () => {
    await monitors.create(newMonitorInput());
    await monitors.create({ ...newMonitorInput(), name: 'Second' });

    const listed = await monitors.list(projectId);
    expect(listed).toHaveLength(2);

    const otherProjectMonitors = await monitors.list(otherProjectId);
    expect(otherProjectMonitors).toHaveLength(0);
  });

  it('gets a monitor scoped to its project and returns null across projects', async () => {
    const created = await monitors.create(newMonitorInput());

    const found = await monitors.get(created.id, projectId);
    expect(found?.id).toBe(created.id);

    const crossProject = await monitors.get(created.id, otherProjectId);
    expect(crossProject).toBeNull();
  });

  it('applies a partial update and leaves untouched fields intact', async () => {
    const created = await monitors.create(newMonitorInput());

    const updated = await monitors.update(created.id, projectId, {
      enabled: false,
      missingData: 'zero',
      condition: { operator: 'gte', value: 10 },
    });

    expect(updated?.enabled).toBe(false);
    expect(updated?.missingData).toBe('zero');
    expect(updated?.condition).toEqual({ operator: 'gte', value: 10 });
    expect(updated?.name).toBe('Revenue floor');
    expect(updated?.window).toBe('1d');
  });

  it('does not update a monitor from another project', async () => {
    const created = await monitors.create(newMonitorInput());

    const updated = await monitors.update(created.id, otherProjectId, { enabled: false });
    expect(updated).toBeNull();

    const unchanged = await monitors.get(created.id, projectId);
    expect(unchanged?.enabled).toBe(true);
  });

  it('deletes a monitor scoped to its project', async () => {
    const created = await monitors.create(newMonitorInput());

    const deletedFromOther = await monitors.delete(created.id, otherProjectId);
    expect(deletedFromOther).toBe(false);

    const deleted = await monitors.delete(created.id, projectId);
    expect(deleted).toBe(true);

    const found = await monitors.get(created.id, projectId);
    expect(found).toBeNull();
  });

  describe('listPage', () => {
    it('returns a page of pageSize with hasMore when more remain', async () => {
      for (let i = 0; i < 3; i += 1) {
        await monitors.create(newMonitorInput());
      }

      const first = await monitors.listPage(projectId, 0, 2);
      expect(first.monitors).toHaveLength(2);
      expect(first.hasMore).toBe(true);

      const second = await monitors.listPage(projectId, 1, 2);
      expect(second.monitors).toHaveLength(1);
      expect(second.hasMore).toBe(false);
    });

    it('orders newest first', async () => {
      for (let i = 0; i < 2; i += 1) {
        await monitors.create(newMonitorInput());
      }

      const page = await monitors.listPage(projectId, 0, 10);
      const times = page.monitors.map((monitor) => monitor.createdAt.getTime());
      expect(times).toEqual([...times].sort((a, b) => b - a));
    });
  });
});
