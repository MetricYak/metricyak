import { and, asc, count, desc, eq, gte, lte, type SQL } from 'drizzle-orm';
import type { Database, Executor } from '../client.js';
import { events } from '../schema/events.js';

export type InsertEventRow = {
  id: string;
  projectId: string;
  name: string;
  source?: string | null;
  timestamp: Date;
  properties: Record<string, unknown>;
};

export type EventRow = {
  id: string;
  name: string;
  source: string | null;
  timestamp: Date;
  properties: Record<string, unknown>;
};

export type EventsQueryParams = {
  projectId: string;
  from?: Date;
  to?: Date;
  limit: number;
  offset: number;
  order: 'asc' | 'desc';
};

export class EventsRepository {
  constructor(private readonly db: Database) {}

  async insertBatch(rows: InsertEventRow[], executor: Executor = this.db): Promise<void> {
    if (rows.length === 0) return;

    await executor.insert(events).values(rows).onConflictDoNothing({ target: events.id });
  }

  private rangeFilters(params: { projectId: string; from?: Date; to?: Date }): SQL[] {
    const filters = [eq(events.projectId, params.projectId)];
    if (params.from) filters.push(gte(events.timestamp, params.from));
    if (params.to) filters.push(lte(events.timestamp, params.to));
    return filters;
  }

  async query(params: EventsQueryParams, executor: Executor = this.db): Promise<EventRow[]> {
    const { limit, offset, order } = params;

    return executor
      .select({
        id: events.id,
        name: events.name,
        source: events.source,
        timestamp: events.timestamp,
        properties: events.properties,
      })
      .from(events)
      .where(and(...this.rangeFilters(params)))
      .orderBy(order === 'asc' ? asc(events.timestamp) : desc(events.timestamp))
      .limit(limit)
      .offset(offset);
  }

  async count(
    params: { projectId: string; from?: Date; to?: Date },
    executor: Executor = this.db,
  ): Promise<number> {
    const [row] = await executor
      .select({ total: count() })
      .from(events)
      .where(and(...this.rangeFilters(params)));
    return row?.total ?? 0;
  }

  async listRecent(
    params: { projectId: string; limit: number },
    executor: Executor = this.db,
  ): Promise<EventRow[]> {
    return this.query(
      { projectId: params.projectId, limit: params.limit, offset: 0, order: 'desc' },
      executor,
    );
  }
}
