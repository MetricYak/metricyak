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
import { ProjectsRepository } from '@/repositories/projects.repository.js';
import * as schema from '@/schema/index.js';
import { organizations } from '@/schema/index.js';

const migrationsFolder = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../migrations',
);

describe('ProjectsRepository.get scoping (integration)', () => {
  let container: StartedPostgreSqlContainer;
  let pool: Pool;
  let db: Database;
  let projects: ProjectsRepository;
  let orgA: string;
  let orgB: string;
  let projectId: string;

  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgres:17-alpine').start();
    pool = new Pool({ connectionString: container.getConnectionUri() });
    db = drizzle({ client: pool, schema, casing: 'snake_case' });
    await migrate(db, { migrationsFolder });
    projects = new ProjectsRepository(db);
  }, 120_000);

  afterAll(async () => {
    await pool?.end();
    await container?.stop();
  });

  beforeEach(async () => {
    await db.execute(sql`truncate table projects, organizations restart identity cascade`);
    const [a] = await db.insert(organizations).values({ slug: 'a', name: 'A' }).returning();
    const [b] = await db.insert(organizations).values({ slug: 'b', name: 'B' }).returning();
    if (!a || !b) throw new Error('failed to seed organizations');
    orgA = a.id;
    orgB = b.id;
    const project = await projects.create({ organizationId: orgA, name: 'Proj' });
    projectId = project.id;
  });

  it('returns the project when looked up by id alone', async () => {
    const project = await projects.get(projectId);
    expect(project?.id).toBe(projectId);
  });

  it('returns the project when scoped to its owning organization', async () => {
    const project = await projects.get(projectId, orgA);
    expect(project?.id).toBe(projectId);
  });

  it('returns null when scoped to a different organization', async () => {
    const project = await projects.get(projectId, orgB);
    expect(project).toBeNull();
  });

  it('returns null for an unknown id', async () => {
    const project = await projects.get(randomUUID());
    expect(project).toBeNull();
  });
});
