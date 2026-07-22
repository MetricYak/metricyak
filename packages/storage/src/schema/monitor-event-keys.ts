import { index, pgTable, primaryKey, uuid, varchar } from 'drizzle-orm/pg-core';
import { monitors } from '@/schema/monitors.js';
import { projects } from '@/schema/projects.js';

export const monitorEventKeys = pgTable(
  'monitor_event_keys',
  {
    monitorId: uuid('monitor_id')
      .notNull()
      .references(() => monitors.id, { onDelete: 'cascade' }),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    eventName: varchar('event_name', { length: 256 }).notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.monitorId, table.eventName] }),
    index('monitor_event_keys_project_event_idx').on(table.projectId, table.eventName),
  ],
);
