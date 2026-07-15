import type { Database } from '@/client.js';
import { type FailedEventPayload, failedEvents } from '@/schema/failed-events.js';

export type RecordFailedEventInput = {
  queue: string;
  jobId: string | null;
  payload: FailedEventPayload;
  error: string;
  attemptsMade: number;
};

export class FailedEventsRepository {
  constructor(private readonly db: Database) {}

  async record(input: RecordFailedEventInput): Promise<void> {
    await this.db.insert(failedEvents).values({
      queue: input.queue,
      jobId: input.jobId,
      payload: input.payload,
      error: input.error,
      attemptsMade: input.attemptsMade,
    });
  }
}
