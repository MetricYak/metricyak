import { randomUUID } from 'node:crypto';
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
import { events, organizations, projects } from '../../schema/index.js';
import { AggregatesRepository } from '../aggregates.repository.js';

const migrationsFolder = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../migrations',
);

const WINDOW_FROM = new Date('2026-01-01T00:00:00.000Z');
const WINDOW_TO = new Date('2026-01-02T00:00:00.000Z');

describe('AggregatesRepository.rawBreakdown (integration)', () => {
  let container: StartedPostgreSqlContainer;
  let pool: Pool;
  let db: Database;
  let repo: AggregatesRepository;
  let projectId: string;

  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgres:17-alpine').start();
    pool = new Pool({ connectionString: container.getConnectionUri() });
    db = drizzle({ client: pool, schema, casing: 'snake_case' });
    await migrate(db, { migrationsFolder });
    repo = new AggregatesRepository(db);
  }, 120_000);

  afterAll(async () => {
    await pool?.end();
    await container?.stop();
  });

  beforeEach(async () => {
    await db.execute(sql`truncate table events, projects, organizations restart identity cascade`);
    const [org] = await db.insert(organizations).values({ slug: 'acme', name: 'Acme' }).returning();
    if (!org) throw new Error('failed to seed organization');
    const [project] = await db
      .insert(projects)
      .values({ organizationId: org.id, name: 'Proj' })
      .returning();
    if (!project) throw new Error('failed to seed project');
    projectId = project.id;
  });

  async function seed(rows: readonly { country: string; amount: string }[]): Promise<void> {
    await db.insert(events).values(
      rows.map((row, index) => ({
        id: randomUUID(),
        projectId,
        name: 'purchase',
        timestamp: new Date(WINDOW_FROM.getTime() + index * 60_000),
        properties: { country: row.country, amount: row.amount },
      })),
    );
  }

  function breakdown() {
    return repo.rawBreakdown({
      projectId,
      eventNames: ['purchase'],
      dimField: 'country',
      valuePath: ['amount'],
      from: WINDOW_FROM,
      to: WINDOW_TO,
    });
  }

  it('does not crash when a matching event has a non-numeric value', async () => {
    await seed([
      { country: 'us', amount: '12.5' },
      { country: 'us', amount: 'oops' },
      { country: 'ca', amount: '8' },
    ]);

    const byDim = new Map((await breakdown()).map((r) => [r.dimValue, r]));

    expect(byDim.get('us')).toMatchObject({ count: 2, sum: 12.5, min: 12.5, max: 12.5 });
    expect(byDim.get('ca')).toMatchObject({ count: 1, sum: 8, min: 8, max: 8 });
  });

  it('folds an all-non-numeric group to sum 0 with null min/max, still counting rows', async () => {
    await seed([
      { country: 'de', amount: 'N/A' },
      { country: 'de', amount: 'bad' },
    ]);

    const [row] = await breakdown();

    expect(row).toMatchObject({ dimValue: 'de', count: 2, sum: 0, min: null, max: null });
  });
});
