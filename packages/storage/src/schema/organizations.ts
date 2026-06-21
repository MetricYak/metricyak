import { boolean, pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';

export const organizations = pgTable('organizations', {
  id: uuid('id').primaryKey().defaultRandom(),
  slug: varchar('slug', { length: 64 }).notNull().unique(),
  name: varchar('name', { length: 64 }).notNull(),
  createdAt: timestamp('created_at', { mode: 'date', precision: 3, withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp('updated_at', { mode: 'date', precision: 3, withTimezone: true })
    .defaultNow()
    .$onUpdateFn(() => new Date())
    .notNull(),
  isActive: boolean('is_active').default(true).notNull(),
});
