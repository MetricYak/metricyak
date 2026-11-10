import { Hono } from "hono";
import { projects } from "@/db/schema/projects.js";
import type { AuthenticatedEnv } from "../env.js";
import { requireOrganizationMember } from "../middleware/organization-access.js";
import { validate } from "../validator.js";
import { createProjectSchema, projectsParamSchema } from "./schemas.js";
import { serializeProject } from "./serializers.js";

export const projectsRouter = new Hono<AuthenticatedEnv>();

projectsRouter.post(
  "/organizations/:organization_id/projects",
  validate("param", projectsParamSchema),
  requireOrganizationMember("owner", "admin"),
  validate("json", createProjectSchema),
  async (c) => {
    const { name } = c.req.valid("json");
    const now = new Date();
    const [record] = await c.var.db
      .insert(projects)
      .values({ organizationId: c.var.organization.id, name, createdAt: now, updatedAt: now })
      .returning();

    if (!record) {
      throw new Error("Insert returned no project");
    }

    return c.json(serializeProject(record), 201);
  },
);
