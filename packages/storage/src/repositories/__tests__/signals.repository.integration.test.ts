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
import { SignalsRepository } from '@/repositories/signals.repository.js';

const migrationsFolder = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../migrations',
);

describe('SignalsRepository (integration)', () => {
  let container: StartedPostgreSqlContainer;
  let pool: Pool;
  let db: NodePgDatabase<typeof schema>;
  let projectId: string;
  let sourceId: string;
  let repo: SignalsRepository;

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
    const source = await new SignalSourcesRepository(db).create({
      projectId,
      name: 'acme/web',
      provider: 'github',
      config: { repo: 'acme/web', environments: [] },
    });
    sourceId = source.id;
    repo = new SignalsRepository(db);
  });

  function deployment(overrides: Partial<Parameters<SignalsRepository['upsert']>[0]> = {}) {
    return {
      projectId,
      sourceId,
      kind: 'deployment' as const,
      externalId: 'deployment:456',
      occurredAt: new Date('2026-07-30T14:02:00Z'),
      observedAt: new Date('2026-07-30T14:02:00Z'),
      endedAt: null,
      title: 'v2.4.1 → production',
      status: 'pending',
      attributes: { sha: 'abc', environment: 'production' },
      ...overrides,
    };
  }

  it('collapses a lifecycle into one row and keeps the latest state', async () => {
    await repo.upsert(deployment());
    await repo.upsert(
      deployment({ status: 'pending', observedAt: new Date('2026-07-30T14:04:00Z') }),
    );
    await repo.upsert(
      deployment({
        status: 'succeeded',
        observedAt: new Date('2026-07-30T14:06:00Z'),
        endedAt: new Date('2026-07-30T14:06:00Z'),
      }),
    );

    const stored = await repo.listByRange({
      projectId,
      from: new Date('2026-07-30T00:00:00Z'),
      to: new Date('2026-07-31T00:00:00Z'),
      limit: 10,
    });

    expect(stored).toHaveLength(1);
    expect(stored[0]?.status).toBe('succeeded');
    expect(stored[0]?.endedAt).toEqual(new Date('2026-07-30T14:06:00Z'));
  });

  it('ignores a stale delivery that arrives after a newer one', async () => {
    await repo.upsert(
      deployment({
        status: 'succeeded',
        observedAt: new Date('2026-07-30T14:06:00Z'),
        endedAt: new Date('2026-07-30T14:06:00Z'),
      }),
    );

    const returned = await repo.upsert(
      deployment({ status: 'pending', observedAt: new Date('2026-07-30T14:02:00Z') }),
    );

    expect(returned.status).toBe('succeeded');

    const [stored] = await repo.listByRange({
      projectId,
      from: new Date('2026-07-30T00:00:00Z'),
      to: new Date('2026-07-31T00:00:00Z'),
      limit: 10,
    });

    expect(stored?.status).toBe('succeeded');
    expect(stored?.endedAt).toEqual(new Date('2026-07-30T14:06:00Z'));
  });

  it('applies a redelivery of the state it already holds', async () => {
    await repo.upsert(deployment({ title: 'v2.4.1 → production' }));

    const returned = await repo.upsert(deployment({ title: 'v2.4.1 → prod' }));

    expect(returned.title).toBe('v2.4.1 → prod');
  });

  it('keeps signals with different external ids apart', async () => {
    await repo.upsert(deployment());
    await repo.upsert(deployment({ externalId: 'deployment:457', title: 'v2.4.2 → production' }));

    const stored = await repo.listByRange({
      projectId,
      from: new Date('2026-07-30T00:00:00Z'),
      to: new Date('2026-07-31T00:00:00Z'),
      limit: 10,
    });

    expect(stored).toHaveLength(2);
  });

  it('returns signals ordered by when they occurred', async () => {
    await repo.upsert(
      deployment({ externalId: 'deployment:1', occurredAt: new Date('2026-07-30T15:00:00Z') }),
    );
    await repo.upsert(
      deployment({ externalId: 'deployment:2', occurredAt: new Date('2026-07-30T13:00:00Z') }),
    );

    const stored = await repo.listByRange({
      projectId,
      from: new Date('2026-07-30T00:00:00Z'),
      to: new Date('2026-07-31T00:00:00Z'),
      limit: 10,
    });

    expect(stored.map((signal) => signal.externalId)).toEqual(['deployment:2', 'deployment:1']);
  });

  it('excludes signals outside the window', async () => {
    await repo.upsert(deployment({ occurredAt: new Date('2026-07-29T14:02:00Z') }));

    const stored = await repo.listByRange({
      projectId,
      from: new Date('2026-07-30T00:00:00Z'),
      to: new Date('2026-07-31T00:00:00Z'),
      limit: 10,
    });

    expect(stored).toEqual([]);
  });

  it('filters by kind when asked', async () => {
    await repo.upsert(deployment());
    await repo.upsert(
      deployment({ externalId: 'flag:checkout', kind: 'flag_change', status: null }),
    );

    const stored = await repo.listByRange({
      projectId,
      from: new Date('2026-07-30T00:00:00Z'),
      to: new Date('2026-07-31T00:00:00Z'),
      kinds: ['flag_change'],
      limit: 10,
    });

    expect(stored).toHaveLength(1);
    expect(stored[0]?.kind).toBe('flag_change');
  });

  it('honours the row cap', async () => {
    for (let index = 0; index < 5; index += 1) {
      await repo.upsert(deployment({ externalId: `deployment:${index}` }));
    }

    const stored = await repo.listByRange({
      projectId,
      from: new Date('2026-07-30T00:00:00Z'),
      to: new Date('2026-07-31T00:00:00Z'),
      limit: 3,
    });

    expect(stored).toHaveLength(3);
  });

  it('refuses to store a signal against a source owned by another project', async () => {
    const [otherOrg] = await db
      .insert(organizations)
      .values({ slug: 'other', name: 'Other' })
      .returning();
    const [otherProject] = await db
      .insert(projects)
      .values({ organizationId: otherOrg?.id ?? '', name: 'Other' })
      .returning();

    await expect(repo.upsert(deployment({ projectId: otherProject?.id ?? '' }))).rejects.toThrow();
  });

  it('removes a source’s signals when the source is deleted', async () => {
    await repo.upsert(deployment());

    await new SignalSourcesRepository(db).delete(sourceId, projectId);

    const stored = await repo.listByRange({
      projectId,
      from: new Date('2026-07-30T00:00:00Z'),
      to: new Date('2026-07-31T00:00:00Z'),
      limit: 10,
    });

    expect(stored).toEqual([]);
  });
});
