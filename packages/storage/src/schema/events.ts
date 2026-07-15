import { sql } from 'drizzle-orm';
import { index, jsonb, pgTable, timestamp, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';
import { projects } from '@/schema/projects.js';

export const events = pgTable(
  'events',
  {
    id: uuid('id').primaryKey(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    insertId: varchar('insert_id', { length: 255 }),
    name: varchar('name', { length: 255 }).notNull(),
    timestamp: timestamp('timestamp', { mode: 'date', precision: 3, withTimezone: true }).notNull(),
    properties: jsonb('properties').$type<Record<string, unknown>>().notNull().default({}),
    ingestedAt: timestamp('ingested_at', { mode: 'date', precision: 3, withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('events_project_id_name_timestamp_idx').on(table.projectId, table.name, table.timestamp),
    uniqueIndex('events_project_id_insert_id_idx')
      .on(table.projectId, table.insertId)
      .where(sql`${table.insertId} is not null`),
  ],
);
