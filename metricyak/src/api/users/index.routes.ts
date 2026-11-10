import { and, eq } from "drizzle-orm";
import { Hono } from "hono";
import { organizations } from "@/db/schema/organizations.js";
import { projects } from "@/db/schema/projects.js";
import { userSelections } from "@/db/schema/user-selections.js";
import type { AuthenticatedEnv } from "../env.js";
import { serializeCurrentUser } from "./serializers.js";

export const usersRouter = new Hono<AuthenticatedEnv>();

usersRouter.get("/users/@me", async (c) => {
  const user = c.var.user;

  const [selection] = await c.var.db
    .select({ organizationId: organizations.id, projectId: projects.id })
    .from(userSelections)
    .innerJoin(
      organizations,
      and(eq(organizations.id, userSelections.organizationId), eq(organizations.isActive, true)),
    )
    .leftJoin(projects, and(eq(projects.id, userSelections.projectId), eq(projects.isActive, true)))
    .where(eq(userSelections.userId, user.id));

  return c.json(
    { user: serializeCurrentUser(user, selection?.organizationId ?? null, selection?.projectId ?? null) },
    200,
  );
});
