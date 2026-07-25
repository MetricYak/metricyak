import { and, eq, gt, isNotNull, isNull, sql } from 'drizzle-orm';
import type { Database } from '@/client.js';
import { generatePublishableKey } from '@/lib/keys.js';
import { projectKeys } from '@/schema/project-keys.js';

export type ProjectKeyRecord = {
  readonly id: string;
  readonly projectId: string;
  readonly key: string;
  readonly createdAt: Date;
  readonly lastUsedAt: Date | null;
  readonly expiresAt: Date | null;
};

export type ProjectKeyState = {
  readonly active: ProjectKeyRecord | null;
  readonly grace: ProjectKeyRecord | null;
};

type ProjectKeyRow = typeof projectKeys.$inferSelect;

function toRecord(row: ProjectKeyRow): ProjectKeyRecord {
  return {
    id: row.id,
    projectId: row.projectId,
    key: row.key,
    createdAt: row.createdAt,
    lastUsedAt: row.lastUsedAt ?? null,
    expiresAt: row.expiresAt ?? null,
  };
}

function partitionByState(rows: readonly ProjectKeyRow[], now: Date): ProjectKeyState {
  const activeRow = rows.find((row) => row.expiresAt === null);
  const graceRow = rows.find((row) => row.expiresAt !== null && row.expiresAt > now);
  return {
    active: activeRow ? toRecord(activeRow) : null,
    grace: graceRow ? toRecord(graceRow) : null,
  };
}

export class ProjectKeysRepository {
  constructor(private readonly db: Database) {}

  async findValidByKey(key: string, now: Date): Promise<{ id: string; projectId: string } | null> {
    const [row] = await this.db
      .select({ id: projectKeys.id, projectId: projectKeys.projectId })
      .from(projectKeys)
      .where(
        and(
          eq(projectKeys.key, key),
          isNull(projectKeys.revokedAt),
          sql`(${projectKeys.expiresAt} is null or ${projectKeys.expiresAt} > ${now})`,
        ),
      )
      .limit(1);
    return row ?? null;
  }

  async getState(projectId: string, now: Date): Promise<ProjectKeyState> {
    const rows = await this.db
      .select()
      .from(projectKeys)
      .where(and(eq(projectKeys.projectId, projectId), isNull(projectKeys.revokedAt)));
    return partitionByState(rows, now);
  }

  async hasAnyKey(projectId: string): Promise<boolean> {
    const [row] = await this.db
      .select({ id: projectKeys.id })
      .from(projectKeys)
      .where(eq(projectKeys.projectId, projectId))
      .limit(1);
    return row !== undefined;
  }

  async generate(projectId: string): Promise<ProjectKeyRecord> {
    const [row] = await this.db
      .insert(projectKeys)
      .values({ projectId, key: generatePublishableKey() })
      .returning();
    if (!row) throw new Error('Failed to insert project key.');
    return toRecord(row);
  }

  async roll(projectId: string, graceMs: number, now: Date): Promise<ProjectKeyState | null> {
    return this.db.transaction(async (tx) => {
      const [active] = await tx
        .select({ id: projectKeys.id })
        .from(projectKeys)
        .where(
          and(
            eq(projectKeys.projectId, projectId),
            isNull(projectKeys.revokedAt),
            isNull(projectKeys.expiresAt),
          ),
        )
        .for('update')
        .limit(1);

      if (!active) return null;

      await tx
        .update(projectKeys)
        .set({ revokedAt: now })
        .where(
          and(
            eq(projectKeys.projectId, projectId),
            isNull(projectKeys.revokedAt),
            isNotNull(projectKeys.expiresAt),
          ),
        );

      const demoted = await tx
        .update(projectKeys)
        .set({ expiresAt: new Date(now.getTime() + graceMs) })
        .where(
          and(
            eq(projectKeys.projectId, projectId),
            isNull(projectKeys.revokedAt),
            isNull(projectKeys.expiresAt),
          ),
        )
        .returning();

      const [created] = await tx
        .insert(projectKeys)
        .values({ projectId, key: generatePublishableKey() })
        .returning();
      if (!created) throw new Error('Failed to insert project key.');

      return partitionByState([...demoted, created], now);
    });
  }

  async revokeAll(projectId: string, now: Date): Promise<boolean> {
    const result = await this.db
      .update(projectKeys)
      .set({ revokedAt: now })
      .where(and(eq(projectKeys.projectId, projectId), isNull(projectKeys.revokedAt)));
    return (result.rowCount ?? 0) > 0;
  }

  async revokeGrace(projectId: string, now: Date): Promise<boolean> {
    const result = await this.db
      .update(projectKeys)
      .set({ revokedAt: now })
      .where(
        and(
          eq(projectKeys.projectId, projectId),
          isNull(projectKeys.revokedAt),
          isNotNull(projectKeys.expiresAt),
          gt(projectKeys.expiresAt, now),
        ),
      );
    return (result.rowCount ?? 0) > 0;
  }

  async touchLastUsed(keyId: string, now: Date): Promise<void> {
    await this.db.update(projectKeys).set({ lastUsedAt: now }).where(eq(projectKeys.id, keyId));
  }
}
