import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { Database } from '@/client.js';
import { ProjectKeysRepository } from '@/repositories/project-keys.repository.js';
import { ProjectsRepository } from '@/repositories/projects.repository.js';
import * as schema from '@/schema/index.js';
import { organizations, projectKeys as projectKeysTable } from '@/schema/index.js';

const migrationsFolder = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../migrations',
);

const GRACE_MS = 24 * 60 * 60 * 1000;
const NOW = new Date('2026-07-25T12:00:00.000Z');

describe('ProjectKeysRepository (integration)', () => {
  let container: StartedPostgreSqlContainer;
  let pool: Pool;
  let db: Database;
  let keys: ProjectKeysRepository;
  let projectId: string;
  let otherProjectId: string;

  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgres:17-alpine').start();
    pool = new Pool({ connectionString: container.getConnectionUri() });
    db = drizzle({ client: pool, schema, casing: 'snake_case' });
    await migrate(db, { migrationsFolder });
    keys = new ProjectKeysRepository(db);
  }, 120_000);

  afterAll(async () => {
    await pool?.end();
    await container?.stop();
  });

  beforeEach(async () => {
    await db.execute(sql`truncate table projects, organizations restart identity cascade`);
    const [org] = await db.insert(organizations).values({ slug: 'a', name: 'A' }).returning();
    if (!org) throw new Error('failed to seed organization');
    const projects = new ProjectsRepository(db);
    const project = await projects.create({ organizationId: org.id, name: 'Proj' });
    const other = await projects.create({ organizationId: org.id, name: 'Other' });
    projectId = project.id;
    otherProjectId = other.id;
  });

  it('generates an active key with no expiry', async () => {
    const record = await keys.generate(projectId);

    expect(record.key).toMatch(/^myk_[A-Za-z0-9]{43}$/);
    expect(record.expiresAt).toBeNull();
    expect(record.lastUsedAt).toBeNull();
  });

  it('rejects a second active key for the same project', async () => {
    await keys.generate(projectId);

    await expect(keys.generate(projectId)).rejects.toThrow();
  });

  it('allows an active key per project independently', async () => {
    await keys.generate(projectId);
    const other = await keys.generate(otherProjectId);

    expect(other.projectId).toBe(otherProjectId);
  });

  it('reports the active key and no grace key before any roll', async () => {
    const created = await keys.generate(projectId);

    const state = await keys.getState(projectId, NOW);

    expect(state.active?.key).toBe(created.key);
    expect(state.grace).toBeNull();
  });

  it('demotes the old key to grace and creates one new active key on roll', async () => {
    const original = await keys.generate(projectId);

    const state = await keys.roll(projectId, GRACE_MS, NOW);

    expect(state?.grace?.key).toBe(original.key);
    expect(state?.grace?.expiresAt).toEqual(new Date(NOW.getTime() + GRACE_MS));
    expect(state?.active?.key).not.toBe(original.key);
  });

  it('returns null when rolling a project with no active key', async () => {
    expect(await keys.roll(projectId, GRACE_MS, NOW)).toBeNull();
  });

  it('revokes the outgoing grace key when rolling twice', async () => {
    const first = await keys.generate(projectId);
    await keys.roll(projectId, GRACE_MS, NOW);
    const second = await keys.getState(projectId, NOW);

    const state = await keys.roll(projectId, GRACE_MS, NOW);

    expect(state?.grace?.key).toBe(second.active?.key);
    expect(await keys.findValidByKey(first.key, NOW)).toBeNull();
  });

  it('accepts a grace key before it expires and rejects it after', async () => {
    const original = await keys.generate(projectId);
    await keys.roll(projectId, GRACE_MS, NOW);

    const beforeExpiry = new Date(NOW.getTime() + GRACE_MS - 1000);
    const afterExpiry = new Date(NOW.getTime() + GRACE_MS + 1000);

    expect(await keys.findValidByKey(original.key, beforeExpiry)).not.toBeNull();
    expect(await keys.findValidByKey(original.key, afterExpiry)).toBeNull();
  });

  it('omits an expired grace key from state', async () => {
    await keys.generate(projectId);
    await keys.roll(projectId, GRACE_MS, NOW);

    const state = await keys.getState(projectId, new Date(NOW.getTime() + GRACE_MS + 1000));

    expect(state.grace).toBeNull();
    expect(state.active).not.toBeNull();
  });

  it('revokes both the active and grace keys', async () => {
    const original = await keys.generate(projectId);
    const rolled = await keys.roll(projectId, GRACE_MS, NOW);

    expect(await keys.revokeAll(projectId, NOW)).toBe(true);

    expect(await keys.findValidByKey(original.key, NOW)).toBeNull();
    expect(await keys.findValidByKey(rolled?.active?.key ?? '', NOW)).toBeNull();
  });

  it('revokes only the grace key, leaving the active key valid', async () => {
    const original = await keys.generate(projectId);
    const rolled = await keys.roll(projectId, GRACE_MS, NOW);

    expect(await keys.revokeGrace(projectId, NOW)).toBe(true);

    expect(await keys.findValidByKey(original.key, NOW)).toBeNull();
    expect(await keys.findValidByKey(rolled?.active?.key ?? '', NOW)).not.toBeNull();
  });

  it('reports whether a project has ever had a key, including revoked ones', async () => {
    expect(await keys.hasAnyKey(projectId)).toBe(false);

    await keys.generate(projectId);
    await keys.revokeAll(projectId, NOW);

    expect(await keys.hasAnyKey(projectId)).toBe(true);
  });

  it('allows generating a new key after a revoke', async () => {
    await keys.generate(projectId);
    await keys.revokeAll(projectId, NOW);

    const replacement = await keys.generate(projectId);

    expect((await keys.getState(projectId, NOW)).active?.key).toBe(replacement.key);
  });

  it('records last used', async () => {
    const record = await keys.generate(projectId);

    await keys.touchLastUsed(record.id, NOW);

    expect((await keys.getState(projectId, NOW)).active?.lastUsedAt).toEqual(NOW);
  });

  it('returns null for an unknown key', async () => {
    expect(await keys.findValidByKey('myk_nope', NOW)).toBeNull();
  });

  it('scopes revocation to the given project', async () => {
    const mine = await keys.generate(projectId);
    await keys.generate(otherProjectId);

    await keys.revokeAll(otherProjectId, NOW);

    expect(await keys.findValidByKey(mine.key, NOW)).not.toBeNull();
  });

  it('leaves no active key row after revoking', async () => {
    await keys.generate(projectId);
    await keys.revokeAll(projectId, NOW);

    const rows = await db.select().from(projectKeysTable);

    expect(rows.every((row) => row.revokedAt !== null)).toBe(true);
  });
});
