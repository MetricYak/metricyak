import { index, pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { bytea } from '@/schema/bytea.js';
import { projects } from '@/schema/projects.js';

export const secrets = pgTable(
  'secrets',
  {
    id: uuid('id').primaryKey(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 128 }).notNull(),
    ciphertext: bytea('ciphertext').notNull(),
    createdAt: timestamp('created_at', { mode: 'date', precision: 3, withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { mode: 'date', precision: 3, withTimezone: true })
      .defaultNow()
      .$onUpdateFn(() => new Date())
      .notNull(),
  },
  (table) => [index('secrets_project_id_idx').on(table.projectId)],
);
