import { integer, jsonb, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';

export type FailedEventPayload = {
  projectId: string;
  events: Array<{
    id: string;
    name: string;
    timestamp: string;
    properties: Record<string, unknown>;
  }>;
};

export const failedEvents = pgTable('failed_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  queue: varchar('queue', { length: 128 }).notNull(),
  jobId: varchar('job_id', { length: 255 }),
  payload: jsonb('payload').$type<FailedEventPayload>().notNull(),
  error: text('error').notNull(),
  attemptsMade: integer('attempts_made').notNull(),
  failedAt: timestamp('failed_at', { mode: 'date', precision: 3, withTimezone: true })
    .defaultNow()
    .notNull(),
});
