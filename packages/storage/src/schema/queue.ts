import { index, jsonb, pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';

export const queuedEvents = pgTable(
  'queued_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    topic: varchar('topic', { length: 128 }).notNull(),
    payload: jsonb('payload').notNull(),
    createdAt: timestamp('created_at', { mode: 'date', precision: 3, withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [index('queued_events_topic_created_at_idx').on(table.topic, table.createdAt)],
);
