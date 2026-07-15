import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { Database } from '@/client.js';
import { EventsRepository, type InsertEventRow } from '@/repositories/events.repository.js';
import * as schema from '@/schema/index.js';
import { events, organizations, projects } from '@/schema/index.js';

const migrationsFolder = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../migrations',
);

const MINUTE = new Date('2026-01-01T00:00:00.000Z');

describe('event insert_id idempotency (integration)', () => {
  let container: StartedPostgreSqlContainer;
  let pool: Pool;
  let db: Database;
  let eventsRepo: EventsRepository;
  let projectId: string;

  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgres:17-alpine').start();
    pool = new Pool({ connectionString: container.getConnectionUri() });
    db = drizzle({ client: pool, schema, casing: 'snake_case' });
    await migrate(db, { migrationsFolder });
    eventsRepo = new EventsRepository(db);
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

  function eventRow(insertId: string | null): InsertEventRow {
    return {
      id: randomUUID(),
      projectId,
      insertId,
      name: 'purchase',
      timestamp: MINUTE,
      properties: {},
    };
  }

  async function storedEventCount(): Promise<number> {
    const [row] = await db.select({ count: sql<number>`cast(count(*) as int)` }).from(events);
    return row?.count ?? 0;
  }

  it('inserts every row of a first batch and reports their ids', async () => {
    const inserted = await eventsRepo.insertBatch([eventRow('a'), eventRow('b')]);

    expect(inserted).toHaveLength(2);
    expect(await storedEventCount()).toBe(2);
  });

  it('skips rows whose insert_id already exists and reports none inserted', async () => {
    await eventsRepo.insertBatch([eventRow('a'), eventRow('b')]);
    const retried = await eventsRepo.insertBatch([eventRow('a'), eventRow('b')]);

    expect(retried).toHaveLength(0);
    expect(await storedEventCount()).toBe(2);
  });

  it('inserts only the new insert_ids in a partially duplicate batch', async () => {
    await eventsRepo.insertBatch([eventRow('a'), eventRow('b')]);
    const mixed = await eventsRepo.insertBatch([eventRow('b'), eventRow('c')]);

    expect(mixed).toHaveLength(1);
    expect(await storedEventCount()).toBe(3);
  });

  it('never deduplicates events without an insert_id', async () => {
    const inserted = await eventsRepo.insertBatch([eventRow(null), eventRow(null)]);

    expect(inserted).toHaveLength(2);
    expect(await storedEventCount()).toBe(2);
  });
});
