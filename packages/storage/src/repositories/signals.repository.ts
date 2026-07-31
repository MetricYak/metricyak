import type { SignalKind } from '@metricyak/connectors';
import { and, asc, between, eq, inArray } from 'drizzle-orm';
import type { Database, Executor } from '@/client.js';
import { type SignalAttributes, signals } from '@/schema/signals.js';

export type SignalRecord = {
  readonly id: string;
  readonly projectId: string;
  readonly sourceId: string;
  readonly kind: SignalKind;
  readonly externalId: string;
  readonly occurredAt: Date;
  readonly endedAt: Date | null;
  readonly title: string;
  readonly status: string | null;
  readonly attributes: SignalAttributes;
};

export type UpsertSignalInput = {
  readonly projectId: string;
  readonly sourceId: string;
  readonly kind: SignalKind;
  readonly externalId: string;
  readonly occurredAt: Date;
  readonly endedAt: Date | null;
  readonly title: string;
  readonly status: string | null;
  readonly attributes: SignalAttributes;
};

export type ListSignalsInput = {
  readonly projectId: string;
  readonly from: Date;
  readonly to: Date;
  readonly kinds?: readonly SignalKind[];
  readonly sourceId?: string;
  readonly limit: number;
};

function toRecord(row: typeof signals.$inferSelect): SignalRecord {
  return {
    id: row.id,
    projectId: row.projectId,
    sourceId: row.sourceId,
    kind: row.kind,
    externalId: row.externalId,
    occurredAt: row.occurredAt,
    endedAt: row.endedAt,
    title: row.title,
    status: row.status,
    attributes: row.attributes,
  };
}

export class SignalsRepository {
  constructor(private readonly db: Database) {}

  async upsert(input: UpsertSignalInput, executor: Executor = this.db): Promise<SignalRecord> {
    const [row] = await executor
      .insert(signals)
      .values(input)
      .onConflictDoUpdate({
        target: [signals.sourceId, signals.externalId],
        set: {
          occurredAt: input.occurredAt,
          endedAt: input.endedAt,
          title: input.title,
          status: input.status,
          attributes: input.attributes,
          updatedAt: new Date(),
        },
      })
      .returning();

    if (!row) throw new Error('Upserting a signal returned no row.');
    return toRecord(row);
  }

  async listByRange(input: ListSignalsInput): Promise<SignalRecord[]> {
    const filters = [
      eq(signals.projectId, input.projectId),
      between(signals.occurredAt, input.from, input.to),
    ];

    if (input.kinds && input.kinds.length > 0) {
      filters.push(inArray(signals.kind, [...input.kinds]));
    }

    if (input.sourceId) {
      filters.push(eq(signals.sourceId, input.sourceId));
    }

    const rows = await this.db
      .select()
      .from(signals)
      .where(and(...filters))
      .orderBy(asc(signals.occurredAt), asc(signals.id))
      .limit(input.limit);

    return rows.map(toRecord);
  }
}
