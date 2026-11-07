import { sql } from "drizzle-orm";
import { index, snakeCase, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { users } from "./users.js";

export const sessions = snakeCase.table(
  "sessions",
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text().notNull(),
    expiresAt: timestamp({ mode: "date", precision: 3, withTimezone: true }).notNull(),
    createdAt: timestamp({ mode: "date", precision: 3, withTimezone: true }).notNull(),
  },
  (table) => [uniqueIndex().on(table.tokenHash), index().on(table.userId)],
);

export type SessionRecord = typeof sessions.$inferSelect;
