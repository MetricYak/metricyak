import { sql } from "drizzle-orm";
import { index, snakeCase, timestamp, unique, uuid, varchar } from "drizzle-orm/pg-core";
import { organizations } from "./organizations.js";
import { users } from "./users.js";

export const organizationMemberships = snakeCase.table(
  "organization_memberships",
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    organizationId: uuid()
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: varchar({ length: 32 }).notNull(),
    jobRole: varchar({ length: 100 }),
    createdAt: timestamp({ mode: "date", precision: 3, withTimezone: true }).notNull(),
    updatedAt: timestamp({ mode: "date", precision: 3, withTimezone: true }).notNull(),
  },
  (table) => [index().on(table.userId), unique().on(table.organizationId, table.userId)],
);

export type OrganizationMembershipRecord = typeof organizationMemberships.$inferSelect;
