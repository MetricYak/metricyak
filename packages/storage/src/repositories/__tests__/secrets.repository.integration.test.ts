import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  createSecretCipher,
  generateMasterKey,
  type MasterKey,
  parseMasterKey,
  Secret,
} from '@metricyak/secrets';
import { organizations, projects } from '@metricyak/storage';
import * as schema from '@metricyak/storage/schema';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { eq, sql } from 'drizzle-orm';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { SecretsRepository } from '@/repositories/secrets.repository.js';
import { secrets } from '@/schema/secrets.js';

const migrationsFolder = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../migrations',
);

const PASSWORD = 'p0stgres-pa55word';

function newMasterKey(): MasterKey {
  const parsed = parseMasterKey(generateMasterKey());
  if (parsed.kind !== 'ok') throw new Error(`generateMasterKey produced ${parsed.kind}`);
  return parsed.key;
}

describe('SecretsRepository (integration)', () => {
  let container: StartedPostgreSqlContainer;
  let pool: Pool;
  let db: NodePgDatabase<typeof schema>;
  let repo: SecretsRepository;
  let projectId: string;
  let otherProjectId: string;

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
    await db.execute(sql`truncate table secrets, projects, organizations restart identity cascade`);
    const [org] = await db.insert(organizations).values({ slug: 'acme', name: 'Acme' }).returning();
    const [project] = await db
      .insert(projects)
      .values({ organizationId: org?.id ?? '', name: 'Proj' })
      .returning();
    const [other] = await db
      .insert(projects)
      .values({ organizationId: org?.id ?? '', name: 'Other' })
      .returning();
    projectId = project?.id ?? '';
    otherProjectId = other?.id ?? '';
    repo = new SecretsRepository(db, createSecretCipher(newMasterKey()));
  });

  it('reveals the exact value it stored', async () => {
    const created = await repo.create({
      projectId,
      name: 'postgres-credential',
      value: Secret.of(PASSWORD),
    });

    const revealed = await repo.reveal(created.id, projectId);

    expect(revealed.kind).toBe('ok');
    if (revealed.kind !== 'ok') return;
    expect(revealed.value.expose()).toBe(PASSWORD);
  });

  it('round-trips a serialised multi-field credential', async () => {
    const credential = JSON.stringify({ apiKey: 'phx_abc123', host: 'https://eu.posthog.com' });
    const created = await repo.create({
      projectId,
      name: 'posthog-credential',
      value: Secret.of(credential),
    });

    const revealed = await repo.reveal(created.id, projectId);

    expect(revealed.kind).toBe('ok');
    if (revealed.kind !== 'ok') return;
    expect(JSON.parse(revealed.value.expose())).toEqual({
      apiKey: 'phx_abc123',
      host: 'https://eu.posthog.com',
    });
  });

  it('never returns the plaintext or ciphertext on the record', async () => {
    const created = await repo.create({
      projectId,
      name: 'postgres-credential',
      value: Secret.of(PASSWORD),
    });

    expect(JSON.stringify(created)).not.toContain(PASSWORD);
    expect(Object.keys(created).sort()).toEqual([
      'createdAt',
      'id',
      'name',
      'projectId',
      'updatedAt',
    ]);
  });

  it('stores no readable trace of the plaintext in the column', async () => {
    const created = await repo.create({
      projectId,
      name: 'postgres-credential',
      value: Secret.of(PASSWORD),
    });

    const [row] = await db
      .select({ ciphertext: secrets.ciphertext })
      .from(secrets)
      .where(eq(secrets.id, created.id));

    expect(row?.ciphertext.toString('utf8')).not.toContain(PASSWORD);
    expect(row?.ciphertext.toString('latin1')).not.toContain(PASSWORD);
  });

  it('does not reveal a secret belonging to another project', async () => {
    const created = await repo.create({
      projectId,
      name: 'postgres-credential',
      value: Secret.of(PASSWORD),
    });

    expect(await repo.reveal(created.id, otherProjectId)).toEqual({ kind: 'not_found' });
  });

  it('reports not_found for an unknown id', async () => {
    expect(await repo.reveal('00000000-0000-0000-0000-000000000000', projectId)).toEqual({
      kind: 'not_found',
    });
  });

  it('cannot decrypt a row moved to another project', async () => {
    const created = await repo.create({
      projectId,
      name: 'postgres-credential',
      value: Secret.of(PASSWORD),
    });

    await db.update(secrets).set({ projectId: otherProjectId }).where(eq(secrets.id, created.id));

    expect(await repo.reveal(created.id, otherProjectId)).toEqual({ kind: 'undecryptable' });
  });

  it('cannot decrypt a row written under a different master key', async () => {
    const created = await repo.create({
      projectId,
      name: 'postgres-credential',
      value: Secret.of(PASSWORD),
    });
    const rekeyed = new SecretsRepository(db, createSecretCipher(newMasterKey()));

    expect(await rekeyed.reveal(created.id, projectId)).toEqual({ kind: 'undecryptable' });
  });

  it('reveals the new value after replace', async () => {
    const created = await repo.create({
      projectId,
      name: 'postgres-credential',
      value: Secret.of(PASSWORD),
    });

    const replaced = await repo.replace(created.id, projectId, Secret.of('rotated-password'));
    const revealed = await repo.reveal(created.id, projectId);

    expect(replaced?.id).toBe(created.id);
    expect(revealed.kind).toBe('ok');
    if (revealed.kind !== 'ok') return;
    expect(revealed.value.expose()).toBe('rotated-password');
  });

  it('does not replace a secret belonging to another project', async () => {
    const created = await repo.create({
      projectId,
      name: 'postgres-credential',
      value: Secret.of(PASSWORD),
    });

    expect(await repo.replace(created.id, otherProjectId, Secret.of('nope'))).toBeNull();

    const revealed = await repo.reveal(created.id, projectId);
    expect(revealed.kind).toBe('ok');
    if (revealed.kind !== 'ok') return;
    expect(revealed.value.expose()).toBe(PASSWORD);
  });

  it('deletes only within the owning project', async () => {
    const created = await repo.create({
      projectId,
      name: 'postgres-credential',
      value: Secret.of(PASSWORD),
    });

    expect(await repo.delete(created.id, otherProjectId)).toBe(false);
    expect(await repo.delete(created.id, projectId)).toBe(true);
    expect(await repo.reveal(created.id, projectId)).toEqual({ kind: 'not_found' });
  });

  it('deletes inside a caller transaction alongside the owning row', async () => {
    const created = await repo.create({
      projectId,
      name: 'postgres-credential',
      value: Secret.of(PASSWORD),
    });

    await db.transaction(async (tx) => {
      await repo.delete(created.id, projectId, tx);
    });

    expect(await repo.reveal(created.id, projectId)).toEqual({ kind: 'not_found' });
  });

  it('leaves the secret in place when the caller transaction rolls back', async () => {
    const created = await repo.create({
      projectId,
      name: 'postgres-credential',
      value: Secret.of(PASSWORD),
    });

    await expect(
      db.transaction(async (tx) => {
        await repo.delete(created.id, projectId, tx);
        throw new Error('owning row failed to delete');
      }),
    ).rejects.toThrow('owning row failed to delete');

    expect((await repo.reveal(created.id, projectId)).kind).toBe('ok');
  });

  it('removes a project’s secrets when the project is deleted', async () => {
    const created = await repo.create({
      projectId,
      name: 'postgres-credential',
      value: Secret.of(PASSWORD),
    });

    await db.delete(projects).where(eq(projects.id, projectId));

    expect(await repo.reveal(created.id, projectId)).toEqual({ kind: 'not_found' });
  });

  it('lists only the metadata of a project’s own secrets', async () => {
    await repo.create({ projectId, name: 'first', value: Secret.of('a') });
    await repo.create({ projectId, name: 'second', value: Secret.of('b') });
    await repo.create({ projectId: otherProjectId, name: 'elsewhere', value: Secret.of('c') });

    const listed = await repo.listByProject(projectId);

    expect(listed.map((secret) => secret.name).sort()).toEqual(['first', 'second']);
    expect(JSON.stringify(listed)).not.toContain('ciphertext');
  });
});
