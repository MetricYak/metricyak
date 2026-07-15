import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { Database } from '@/client.js';
import { AggregatesRepository } from '@/repositories/aggregates.repository.js';
import * as schema from '@/schema/index.js';

const migrationsFolder = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../migrations',
);

const METRIC_ID = '11111111-1111-1111-1111-111111111111';

describe('AggregatesRepository.admitDimensionValues (integration)', () => {
  let container: StartedPostgreSqlContainer;
  let pool: Pool;
  let db: Database;
  let repo: AggregatesRepository;

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
    await db.execute(sql`truncate table metric_dimension_values`);
  });

  it('admits new values up to the cap and folds the rest to $other', async () => {
    const accepted = await repo.admitDimensionValues(
      METRIC_ID,
      1,
      'country',
      ['us', 'ca', 'de'],
      2,
    );
    expect(accepted).toEqual(new Set(['us', 'ca']));
    expect(await repo.knownDimensionValues(METRIC_ID, 1, 'country')).toEqual(new Set(['us', 'ca']));
  });

  it('does not overshoot the cap across successive batches', async () => {
    await repo.admitDimensionValues(METRIC_ID, 1, 'country', ['us', 'ca'], 2);
    const accepted = await repo.admitDimensionValues(METRIC_ID, 1, 'country', ['de', 'fr'], 2);
    expect(accepted).toEqual(new Set(['us', 'ca']));
    expect((await repo.knownDimensionValues(METRIC_ID, 1, 'country')).size).toBe(2);
  });

  it('treats already-known values as accepted without consuming cap room', async () => {
    await repo.admitDimensionValues(METRIC_ID, 1, 'country', ['us'], 2);
    const accepted = await repo.admitDimensionValues(METRIC_ID, 1, 'country', ['us', 'ca'], 2);
    expect(accepted).toEqual(new Set(['us', 'ca']));
  });
});
