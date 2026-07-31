import type { SignalProviderId } from '@metricyak/connectors';
import { and, asc, eq } from 'drizzle-orm';
import type { Database, Executor } from '@/client.js';
import {
  type SignalConnectionKind,
  type SignalSourceConfig,
  type SignalSourceStatus,
  signalSources,
} from '@/schema/signal-sources.js';

export type SignalSourceRecord = {
  readonly id: string;
  readonly projectId: string;
  readonly name: string;
  readonly provider: SignalProviderId;
  readonly connectionKind: SignalConnectionKind;
  readonly config: SignalSourceConfig;
  readonly installationId: string | null;
  readonly secretId: string | null;
  readonly status: SignalSourceStatus;
  readonly lastDeliveryAt: Date | null;
  readonly lastError: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
};

export type CreateSignalSourceInput = {
  readonly projectId: string;
  readonly name: string;
  readonly provider: SignalProviderId;
  readonly config: SignalSourceConfig;
  readonly connectionKind?: SignalConnectionKind;
  readonly installationId?: string | null;
  readonly secretId?: string | null;
};

export type UpdateSignalSourceInput = {
  readonly name?: string;
  readonly config?: SignalSourceConfig;
  readonly secretId?: string | null;
};

function toRecord(row: typeof signalSources.$inferSelect): SignalSourceRecord {
  return {
    id: row.id,
    projectId: row.projectId,
    name: row.name,
    provider: row.provider,
    connectionKind: row.connectionKind,
    config: row.config,
    installationId: row.installationId,
    secretId: row.secretId,
    status: row.status,
    lastDeliveryAt: row.lastDeliveryAt,
    lastError: row.lastError,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export class SignalSourcesRepository {
  constructor(private readonly db: Database) {}

  async create(
    input: CreateSignalSourceInput,
    executor: Executor = this.db,
  ): Promise<SignalSourceRecord> {
    const [row] = await executor
      .insert(signalSources)
      .values({
        projectId: input.projectId,
        name: input.name,
        provider: input.provider,
        connectionKind: input.connectionKind ?? 'manual_webhook',
        config: input.config,
        installationId: input.installationId ?? null,
        secretId: input.secretId ?? null,
      })
      .returning();

    if (!row) throw new Error('Inserting a signal source returned no row.');
    return toRecord(row);
  }

  async get(id: string, projectId: string): Promise<SignalSourceRecord | null> {
    const [row] = await this.db
      .select()
      .from(signalSources)
      .where(and(eq(signalSources.id, id), eq(signalSources.projectId, projectId)))
      .limit(1);

    return row ? toRecord(row) : null;
  }

  async findForDelivery(id: string): Promise<SignalSourceRecord | null> {
    const [row] = await this.db
      .select()
      .from(signalSources)
      .where(eq(signalSources.id, id))
      .limit(1);

    return row ? toRecord(row) : null;
  }

  async listByProject(projectId: string): Promise<SignalSourceRecord[]> {
    const rows = await this.db
      .select()
      .from(signalSources)
      .where(eq(signalSources.projectId, projectId))
      .orderBy(asc(signalSources.createdAt), asc(signalSources.id));

    return rows.map(toRecord);
  }

  async update(
    id: string,
    projectId: string,
    input: UpdateSignalSourceInput,
  ): Promise<SignalSourceRecord | null> {
    const [row] = await this.db
      .update(signalSources)
      .set(input)
      .where(and(eq(signalSources.id, id), eq(signalSources.projectId, projectId)))
      .returning();

    return row ? toRecord(row) : null;
  }

  async recordDelivery(id: string, at: Date): Promise<void> {
    await this.db
      .update(signalSources)
      .set({ status: 'healthy', lastDeliveryAt: at, lastError: null })
      .where(eq(signalSources.id, id));
  }

  async recordFailure(id: string, reason: string, at: Date): Promise<void> {
    await this.db
      .update(signalSources)
      .set({ status: 'failing', lastDeliveryAt: at, lastError: reason })
      .where(eq(signalSources.id, id));
  }

  async delete(id: string, projectId: string): Promise<boolean> {
    const deleted = await this.db
      .delete(signalSources)
      .where(and(eq(signalSources.id, id), eq(signalSources.projectId, projectId)))
      .returning({ id: signalSources.id });

    return deleted.length > 0;
  }
}
