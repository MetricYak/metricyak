import { index, jsonb, pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { projects } from './projects.js';

export const events = pgTable(
  'events',
  {
    id: uuid('id').primaryKey(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 255 }).notNull(),
    source: varchar('source', { length: 255 }),
    timestamp: timestamp('timestamp', { mode: 'date', precision: 3, withTimezone: true }).notNull(),
    properties: jsonb('properties').$type<Record<string, unknown>>().notNull().default({}),
    ingestedAt: timestamp('ingested_at', { mode: 'date', precision: 3, withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('events_project_id_name_timestamp_idx').on(table.projectId, table.name, table.timestamp),
    index('events_project_id_source_timestamp_idx').on(
      table.projectId,
      table.source,
      table.timestamp,
    ),
  ],
);
