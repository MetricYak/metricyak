import { sql } from 'drizzle-orm';
import { index, pgTable, timestamp, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';
import { projects } from '@/schema/projects.js';

export const projectKeys = pgTable(
  'project_keys',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    key: varchar('key', { length: 64 }).notNull(),
    createdAt: timestamp('created_at', { mode: 'date', precision: 3, withTimezone: true })
      .defaultNow()
      .notNull(),
    lastUsedAt: timestamp('last_used_at', { mode: 'date', precision: 3, withTimezone: true }),
    expiresAt: timestamp('expires_at', { mode: 'date', precision: 3, withTimezone: true }),
    revokedAt: timestamp('revoked_at', { mode: 'date', precision: 3, withTimezone: true }),
    updatedAt: timestamp('updated_at', { mode: 'date', precision: 3, withTimezone: true })
      .defaultNow()
      .$onUpdateFn(() => new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex('project_keys_key_idx').on(table.key),
    index('project_keys_project_id_idx').on(table.projectId),
    uniqueIndex('project_keys_one_active_idx')
      .on(table.projectId)
      .where(sql`revoked_at is null and expires_at is null`),
  ],
);
