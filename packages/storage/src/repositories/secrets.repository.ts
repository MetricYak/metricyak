import { randomUUID } from 'node:crypto';
import type { DecryptResult, Secret, SecretCipher } from '@metricyak/secrets';
import { and, asc, eq } from 'drizzle-orm';
import type { Database, Executor } from '@/client.js';
import { secrets } from '@/schema/secrets.js';

export type SecretRecord = {
  readonly id: string;
  readonly projectId: string;
  readonly name: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
};

export type CreateSecretInput = {
  readonly projectId: string;
  readonly name: string;
  readonly value: Secret;
};

export type RevealResult = DecryptResult | { kind: 'not_found' };

function toRecord(row: typeof secrets.$inferSelect): SecretRecord {
  return {
    id: row.id,
    projectId: row.projectId,
    name: row.name,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function additionalData(projectId: string, secretId: string): string {
  return `${projectId}:${secretId}`;
}

export type SecretsWriter = Pick<
  SecretsRepository,
  'create' | 'replace' | 'delete' | 'listByProject'
>;

export function secretsWriter(repository: SecretsRepository): SecretsWriter {
  return {
    create: repository.create.bind(repository),
    replace: repository.replace.bind(repository),
    delete: repository.delete.bind(repository),
    listByProject: repository.listByProject.bind(repository),
  };
}

export class SecretsRepository {
  constructor(
    private readonly db: Database,
    private readonly cipher: SecretCipher,
  ) {}

  async create(input: CreateSecretInput, executor: Executor = this.db): Promise<SecretRecord> {
    const id = randomUUID();
    const ciphertext = this.cipher.encrypt(input.value, additionalData(input.projectId, id));

    const [row] = await executor
      .insert(secrets)
      .values({ id, projectId: input.projectId, name: input.name, ciphertext })
      .returning();

    if (!row) throw new Error('Inserting a secret returned no row.');
    return toRecord(row);
  }

  async replace(
    id: string,
    projectId: string,
    value: Secret,
    executor: Executor = this.db,
  ): Promise<SecretRecord | null> {
    const ciphertext = this.cipher.encrypt(value, additionalData(projectId, id));

    const [row] = await executor
      .update(secrets)
      .set({ ciphertext })
      .where(and(eq(secrets.id, id), eq(secrets.projectId, projectId)))
      .returning();

    return row ? toRecord(row) : null;
  }

  async reveal(id: string, projectId: string): Promise<RevealResult> {
    const [row] = await this.db
      .select({ ciphertext: secrets.ciphertext })
      .from(secrets)
      .where(and(eq(secrets.id, id), eq(secrets.projectId, projectId)))
      .limit(1);

    if (!row) return { kind: 'not_found' };
    return this.cipher.decrypt(row.ciphertext, additionalData(projectId, id));
  }

  async delete(id: string, projectId: string, executor: Executor = this.db): Promise<boolean> {
    const deleted = await executor
      .delete(secrets)
      .where(and(eq(secrets.id, id), eq(secrets.projectId, projectId)))
      .returning({ id: secrets.id });

    return deleted.length > 0;
  }

  async listByProject(projectId: string): Promise<SecretRecord[]> {
    const rows = await this.db
      .select()
      .from(secrets)
      .where(eq(secrets.projectId, projectId))
      .orderBy(asc(secrets.createdAt), asc(secrets.id));

    return rows.map(toRecord);
  }
}
