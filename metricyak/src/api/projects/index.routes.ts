import { and, eq } from "drizzle-orm";
import { Hono } from "hono";
import { organizations } from "@/db/schema/organizations.js";
import { projects } from "@/db/schema/projects.js";
import { NotFoundError } from "@/errors/index.js";
import type { AppEnv } from "../env.js";
import { validate } from "../validator.js";
import { createProjectSchema, projectsParamSchema } from "./schemas.js";
import { serializeProject } from "./serializers.js";

export const projectsRouter = new Hono<AppEnv>();

projectsRouter.post(
  "/organizations/:organization_id/projects",
  validate("param", projectsParamSchema),
  validate("json", createProjectSchema),
  async (c) => {
    const { organization_id: organizationId } = c.req.valid("param");
    const [organization] = await c.var.db
      .select()
      .from(organizations)
      .where(and(eq(organizations.id, organizationId), eq(organizations.isActive, true)));

    if (!organization) {
      throw new NotFoundError({ code: "organization_not_found", detail: "Organization was not found" });
    }

    const { name } = c.req.valid("json");
    const now = new Date();
    const [record] = await c.var.db
      .insert(projects)
      .values({ organizationId: organization.id, name, createdAt: now, updatedAt: now })
      .returning();

    if (!record) {
      throw new Error("Insert returned no project");
    }

    return c.json(serializeProject(record), 201);
  },
);
