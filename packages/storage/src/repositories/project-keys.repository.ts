import { and, eq, isNull } from 'drizzle-orm';
import type { Database } from '@/client.js';
import { generatePublishableKey, hashKey } from '@/lib/keys.js';
import { projectKeys } from '@/schema/project-keys.js';

export type CreateProjectKeyInput = {
  projectId: string;
  name: string;
};

export type ProjectKeyRecord = {
  id: string;
  projectId: string;
  name: string;
  createdAt: Date;
  revokedAt: Date | null;
  updatedAt: Date;
};

export type CreatedProjectKeyRecord = ProjectKeyRecord & {
  key: string;
};

export class ProjectKeysRepository {
  constructor(private readonly db: Database) {}

  async findActiveByKey(key: string): Promise<{ id: string; projectId: string } | null> {
    const [row] = await this.db
      .select({ id: projectKeys.id, projectId: projectKeys.projectId })
      .from(projectKeys)
      .where(and(eq(projectKeys.key, hashKey(key)), isNull(projectKeys.revokedAt)))
      .limit(1);

    return row ?? null;
  }

  async create(input: CreateProjectKeyInput): Promise<CreatedProjectKeyRecord> {
    const key = generatePublishableKey();

    const [record] = await this.db
      .insert(projectKeys)
      .values({ projectId: input.projectId, name: input.name, key: hashKey(key) })
      .returning();

    if (!record) {
      throw new Error('Failed to insert project key.');
    }

    return {
      id: record.id,
      projectId: record.projectId,
      name: record.name,
      key,
      createdAt: record.createdAt,
      revokedAt: record.revokedAt ?? null,
      updatedAt: record.updatedAt,
    };
  }

  async revoke(projectId: string, keyId: string): Promise<boolean> {
    const result = await this.db
      .update(projectKeys)
      .set({ revokedAt: new Date() })
      .where(
        and(
          eq(projectKeys.id, keyId),
          eq(projectKeys.projectId, projectId),
          isNull(projectKeys.revokedAt),
        ),
      );

    return (result.rowCount ?? 0) > 0;
  }

  async listByProject(projectId: string): Promise<ProjectKeyRecord[]> {
    const rows = await this.db
      .select({
        id: projectKeys.id,
        projectId: projectKeys.projectId,
        name: projectKeys.name,
        createdAt: projectKeys.createdAt,
        revokedAt: projectKeys.revokedAt,
        updatedAt: projectKeys.updatedAt,
      })
      .from(projectKeys)
      .where(eq(projectKeys.projectId, projectId));

    return rows.map((r) => ({
      ...r,
      revokedAt: r.revokedAt ?? null,
    }));
  }
}
