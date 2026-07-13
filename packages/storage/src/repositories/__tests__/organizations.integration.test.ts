import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import * as schema from '../../schema/index.js';
import { OrganizationsRepository } from '../organizations.repository.js';

const migrationsFolder = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../migrations',
);

let container: StartedPostgreSqlContainer;
let pool: Pool;
let repo: OrganizationsRepository;

beforeAll(async () => {
  container = await new PostgreSqlContainer('postgres:17-alpine').start();
  pool = new Pool({ connectionString: container.getConnectionUri() });
  const db = drizzle({ client: pool, schema, casing: 'snake_case' });
  await migrate(db, { migrationsFolder });
  repo = new OrganizationsRepository(db);
}, 120_000);

afterAll(async () => {
  await pool?.end();
  await container?.stop();
});

beforeEach(async () => {
  await pool.query('TRUNCATE organizations CASCADE');
});

describe('OrganizationsRepository', () => {
  it('creates an organization with a derived slug', async () => {
    const org = await repo.create({ name: 'Acme Rockets' });
    expect(org.name).toBe('Acme Rockets');
    expect(org.slug).toBe('acme-rockets');
    expect(org.id).toMatch(/[0-9a-f-]{36}/);
  });

  it('disambiguates a colliding slug with a numeric suffix', async () => {
    const first = await repo.create({ name: 'Acme' });
    const second = await repo.create({ name: 'Acme' });
    expect(first.slug).toBe('acme');
    expect(second.slug).toBe('acme-2');
  });

  it('lists all organizations', async () => {
    await repo.create({ name: 'One' });
    await repo.create({ name: 'Two' });
    const all = await repo.list();
    expect(all.map((o) => o.name).sort()).toEqual(['One', 'Two']);
  });
});
