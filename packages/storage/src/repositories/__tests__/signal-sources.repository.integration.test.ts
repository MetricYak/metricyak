import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { organizations, projects } from '@metricyak/storage';
import * as schema from '@metricyak/storage/schema';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { sql } from 'drizzle-orm';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { SignalSourcesRepository } from '@/repositories/signal-sources.repository.js';

const migrationsFolder = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../migrations',
);

describe('SignalSourcesRepository (integration)', () => {
  let container: StartedPostgreSqlContainer;
  let pool: Pool;
  let db: NodePgDatabase<typeof schema>;
  let projectId: string;
  let repo: SignalSourcesRepository;

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
      sql`truncate table signals, signal_sources, projects, organizations restart identity cascade`,
    );
    const [org] = await db.insert(organizations).values({ slug: 'acme', name: 'Acme' }).returning();
    const [project] = await db
      .insert(projects)
      .values({ organizationId: org?.id ?? '', name: 'Proj' })
      .returning();
    projectId = project?.id ?? '';
    repo = new SignalSourcesRepository(db);
  });

  const input = { provider: 'github', config: { repo: 'acme/web', environments: [] } } as const;

  it('creates a source awaiting its first delivery', async () => {
    const source = await repo.create({ projectId, name: 'acme/web', ...input });

    expect(source.status).toBe('awaiting_first_delivery');
    expect(source.connectionKind).toBe('manual_webhook');
    expect(source.lastDeliveryAt).toBeNull();
  });

  it('rejects a duplicate name within a project', async () => {
    await repo.create({ projectId, name: 'acme/web', ...input });
    await expect(repo.create({ projectId, name: 'acme/web', ...input })).rejects.toThrow();
  });

  it('scopes get to the owning project', async () => {
    const source = await repo.create({ projectId, name: 'acme/web', ...input });

    expect(await repo.get(source.id, projectId)).not.toBeNull();
    expect(await repo.get(source.id, '00000000-0000-0000-0000-000000000000')).toBeNull();
  });

  it('finds a source by id without a project scope for webhook routing', async () => {
    const source = await repo.create({ projectId, name: 'acme/web', ...input });

    expect((await repo.findForDelivery(source.id))?.projectId).toBe(projectId);
    expect(await repo.findForDelivery('00000000-0000-0000-0000-000000000000')).toBeNull();
  });

  it('marks a source healthy when a delivery lands', async () => {
    const source = await repo.create({ projectId, name: 'acme/web', ...input });
    const at = new Date('2026-07-30T14:02:00Z');

    await repo.recordDelivery(source.id, at);

    const reloaded = await repo.get(source.id, projectId);
    expect(reloaded?.status).toBe('healthy');
    expect(reloaded?.lastDeliveryAt).toEqual(at);
    expect(reloaded?.lastError).toBeNull();
  });

  it('marks a source failing and keeps the reason', async () => {
    const source = await repo.create({ projectId, name: 'acme/web', ...input });

    await repo.recordFailure(source.id, 'Signature did not match.', new Date());

    const reloaded = await repo.get(source.id, projectId);
    expect(reloaded?.status).toBe('failing');
    expect(reloaded?.lastError).toBe('Signature did not match.');
  });

  it('clears the failure when a later delivery succeeds', async () => {
    const source = await repo.create({ projectId, name: 'acme/web', ...input });
    await repo.recordFailure(source.id, 'Signature did not match.', new Date());

    await repo.recordDelivery(source.id, new Date());

    const reloaded = await repo.get(source.id, projectId);
    expect(reloaded?.status).toBe('healthy');
    expect(reloaded?.lastError).toBeNull();
  });

  it('deletes a source scoped to its project', async () => {
    const source = await repo.create({ projectId, name: 'acme/web', ...input });

    expect(await repo.delete(source.id, '00000000-0000-0000-0000-000000000000')).toBe(false);
    expect(await repo.delete(source.id, projectId)).toBe(true);
    expect(await repo.get(source.id, projectId)).toBeNull();
  });
});
