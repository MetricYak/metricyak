import { sql } from "drizzle-orm";
import { boolean, index, snakeCase, timestamp, unique, uuid, varchar } from "drizzle-orm/pg-core";
import { organizations } from "./organizations.js";

export const projects = snakeCase.table(
  "projects",
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    organizationId: uuid()
      .notNull()
      .references(() => organizations.id),
    name: varchar({ length: 216 }).notNull(),
    isActive: boolean().notNull().default(true),
    createdAt: timestamp({ mode: "date", precision: 3, withTimezone: true }).notNull(),
    updatedAt: timestamp({ mode: "date", precision: 3, withTimezone: true }).notNull(),
  },
  (table) => [index().on(table.organizationId), unique().on(table.organizationId, table.id)],
);

export type ProjectRecord = typeof projects.$inferSelect;
