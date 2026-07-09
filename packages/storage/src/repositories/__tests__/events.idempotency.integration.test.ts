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
import { events, organizations, projects, TOTAL_SENTINEL } from '../../schema/index.js';
import { AggregatesRepository, type BucketPartialDelta } from '../aggregates.repository.js';
import { EventsRepository, type InsertEventRow } from '../events.repository.js';

const migrationsFolder = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../migrations',
);

const MINUTE = new Date('2026-01-01T00:00:00.000Z');
const RANGE_START = new Date('2026-01-01T00:00:00.000Z');
const RANGE_END = new Date('2026-01-02T00:00:00.000Z');
const METRIC_ID = randomUUID();

describe('event insert_id idempotency (integration)', () => {
  let container: StartedPostgreSqlContainer;
  let pool: Pool;
  let db: Database;
  let eventsRepo: EventsRepository;
  let aggregates: AggregatesRepository;
  let projectId: string;

  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgres:17-alpine').start();
    pool = new Pool({ connectionString: container.getConnectionUri() });
    db = drizzle({ client: pool, schema, casing: 'snake_case' });
    await migrate(db, { migrationsFolder });
    eventsRepo = new EventsRepository(db);
    aggregates = new AggregatesRepository(db);
  }, 120_000);

  afterAll(async () => {
    await pool?.end();
    await container?.stop();
  });

  beforeEach(async () => {
    await db.execute(
      sql`truncate table events, metric_buckets, projects, organizations restart identity cascade`,
    );
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

  function countDelta(count: number): BucketPartialDelta {
    return {
      metricId: METRIC_ID,
      metricVersion: 1,
      granularity: 'minute',
      bucketStart: MINUTE,
      seriesKey: 'purchases',
      dimName: TOTAL_SENTINEL,
      dimValue: TOTAL_SENTINEL,
      count,
      sum: 0,
      min: null,
      max: null,
    };
  }

  async function ingest(rows: InsertEventRow[]): Promise<void> {
    await db.transaction(async (tx) => {
      const insertedIds = new Set(await eventsRepo.insertBatch(rows, tx));
      const insertedCount = rows.filter((row) => insertedIds.has(row.id)).length;
      const deltas = insertedCount === 0 ? [] : [countDelta(insertedCount)];
      await aggregates.upsertBaseBuckets(deltas, tx);
    });
  }

  async function storedEventCount(): Promise<number> {
    const [row] = await db.select({ count: sql<number>`cast(count(*) as int)` }).from(events);
    return row?.count ?? 0;
  }

  async function bucketCount(): Promise<number> {
    const partials = await aggregates.getPartials({
      metricId: METRIC_ID,
      metricVersion: 1,
      granularity: 'minute',
      rangeStart: RANGE_START,
      rangeEnd: RANGE_END,
    });
    return partials.reduce((total, partial) => total + partial.count, 0);
  }

  it('counts a retried batch with the same insert_id only once', async () => {
    await ingest([eventRow('a'), eventRow('b')]);
    await ingest([eventRow('a'), eventRow('b')]);

    expect(await storedEventCount()).toBe(2);
    expect(await bucketCount()).toBe(2);
  });

  it('counts only the new rows in a partially duplicate batch', async () => {
    await ingest([eventRow('a'), eventRow('b')]);
    await ingest([eventRow('b'), eventRow('c')]);

    expect(await storedEventCount()).toBe(3);
    expect(await bucketCount()).toBe(3);
  });

  it('never deduplicates events without an insert_id', async () => {
    await ingest([eventRow(null), eventRow(null)]);

    expect(await storedEventCount()).toBe(2);
    expect(await bucketCount()).toBe(2);
  });
});
