import type { Database } from '@metricyak/storage';
import { queuedEvents } from '@metricyak/storage';
import type { EventPublisher } from '../publisher.js';

export class PostgresPublisher implements EventPublisher {
  constructor(private readonly db: Database) {}

  async publish(topic: string, message: unknown): Promise<void> {
    await this.db.insert(queuedEvents).values({ topic, payload: message });
  }
}
