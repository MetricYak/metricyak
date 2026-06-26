import type { Database } from '../client.js';
import { events } from '../schema/events.js';

export type InsertEventRow = {
  id: string;
  projectId: string;
  name: string;
  timestamp: Date;
  properties: Record<string, unknown>;
};

export class EventsRepository {
  constructor(private readonly db: Database) {}

  async insertBatch(rows: InsertEventRow[]): Promise<void> {
    if (rows.length === 0) return;

    await this.db.insert(events).values(rows).onConflictDoNothing({ target: events.id });
  }
}
