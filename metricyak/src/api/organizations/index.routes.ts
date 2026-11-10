import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { organizationMemberships } from "@/db/schema/organization-memberships.js";
import { organizations } from "@/db/schema/organizations.js";
import { projects } from "@/db/schema/projects.js";
import { userSelections } from "@/db/schema/user-selections.js";
import type { AuthenticatedEnv } from "../env.js";
import { validate } from "../validator.js";
import { createOrganizationSchema } from "./schemas.js";
import { serializeOrganization } from "./serializers.js";

export const organizationsRouter = new Hono<AuthenticatedEnv>();

organizationsRouter.post("/organizations", validate("json", createOrganizationSchema), async (c) => {
  const { name } = c.req.valid("json");
  const user = c.var.user;
  const now = new Date();

  const record = await c.var.db.transaction(async (tx) => {
    const [selection] = await tx.select().from(userSelections).where(eq(userSelections.userId, user.id));

    const [organization] = await tx.insert(organizations).values({ name, createdAt: now, updatedAt: now }).returning();
    if (!organization) {
      throw new Error("Insert returned no organization");
    }

    await tx.insert(organizationMemberships).values({
      organizationId: organization.id,
      userId: user.id,
      role: "owner",
      createdAt: now,
      updatedAt: now,
    });

    const [project] = await tx
      .insert(projects)
      .values({ organizationId: organization.id, name: "Default project", createdAt: now, updatedAt: now })
      .returning();
    if (!project) {
      throw new Error("Insert returned no project");
    }

    if (!selection) {
      await tx
        .insert(userSelections)
        .values({ userId: user.id, organizationId: organization.id, projectId: project.id, updatedAt: now });
    }

    return organization;
  });

  return c.json(serializeOrganization(record), 201);
});
