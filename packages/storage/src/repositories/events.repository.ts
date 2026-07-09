import type { Database, Executor } from '../client.js';
import { events } from '../schema/events.js';

export type InsertEventRow = {
  id: string;
  projectId: string;
  insertId: string | null;
  name: string;
  timestamp: Date;
  properties: Record<string, unknown>;
};

export class EventsRepository {
  constructor(private readonly db: Database) {}

  async insertBatch(rows: InsertEventRow[], executor: Executor = this.db): Promise<string[]> {
    if (rows.length === 0) return [];

    const inserted = await executor
      .insert(events)
      .values(rows)
      .onConflictDoNothing()
      .returning({ id: events.id });

    return inserted.map((row) => row.id);
  }
}
