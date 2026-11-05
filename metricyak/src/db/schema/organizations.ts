import { sql } from "drizzle-orm";
import { boolean, snakeCase, timestamp, uuid, varchar } from "drizzle-orm/pg-core";

export const organizations = snakeCase.table("organizations", {
  id: uuid().primaryKey().default(sql`uuidv7()`),
  name: varchar({ length: 72 }).notNull(),
  isActive: boolean().notNull().default(true),
  createdAt: timestamp({ mode: "date", precision: 3, withTimezone: true })
    .notNull()
    .defaultNow()
    .$defaultFn(() => new Date()),
  updatedAt: timestamp({ mode: "date", precision: 3, withTimezone: true })
    .notNull()
    .defaultNow()
    .$defaultFn(() => new Date())
    .$onUpdateFn(() => new Date()),
});

export type OrganizationRecord = typeof organizations.$inferSelect;
