import { foreignKey, index, snakeCase, timestamp, uuid } from "drizzle-orm/pg-core";
import { organizationMemberships } from "./organization-memberships.js";
import { projects } from "./projects.js";
import { users } from "./users.js";

export const userSelections = snakeCase.table(
  "user_selections",
  {
    userId: uuid()
      .primaryKey()
      .references(() => users.id, { onDelete: "cascade" }),
    organizationId: uuid().notNull(),
    projectId: uuid().notNull(),
    updatedAt: timestamp({ mode: "date", precision: 3, withTimezone: true }).notNull(),
  },
  (table) => [
    foreignKey({
      name: "user_selections_organization_membership_fkey",
      columns: [table.organizationId, table.userId],
      foreignColumns: [organizationMemberships.organizationId, organizationMemberships.userId],
    }).onDelete("cascade"),
    foreignKey({
      name: "user_selections_project_fkey",
      columns: [table.organizationId, table.projectId],
      foreignColumns: [projects.organizationId, projects.id],
    }).onDelete("cascade"),
    index().on(table.projectId),
  ],
);

export type UserSelectionRecord = typeof userSelections.$inferSelect;
