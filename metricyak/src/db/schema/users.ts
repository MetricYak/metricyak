import { sql } from "drizzle-orm";
import { boolean, check, snakeCase, text, timestamp, uniqueIndex, uuid, varchar } from "drizzle-orm/pg-core";

export const users = snakeCase.table(
  "users",
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    firstName: varchar({ length: 150 }).notNull(),
    lastName: varchar({ length: 150 }),
    email: varchar({ length: 254 }).notNull(),
    passwordHash: text(),
    emailVerifiedAt: timestamp({ mode: "date", precision: 3, withTimezone: true }),
    heardAboutUs: varchar({ length: 255 }),
    jobRole: varchar({ length: 100 }),
    isActive: boolean().notNull().default(true),
    createdAt: timestamp({ mode: "date", precision: 3, withTimezone: true }).notNull(),
    updatedAt: timestamp({ mode: "date", precision: 3, withTimezone: true }).notNull(),
  },
  (table) => [
    uniqueIndex().on(table.email),
    check("users_email_lowercase", sql`${table.email} = lower(${table.email})`),
  ],
);

export type UserRecord = typeof users.$inferSelect;
