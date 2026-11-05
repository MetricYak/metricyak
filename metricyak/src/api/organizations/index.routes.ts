import { Hono } from "hono";
import { organizations } from "@/db/schema/organizations.js";
import type { AppEnv } from "../env.js";
import { validate } from "../validator.js";
import { createOrganizationSchema } from "./schemas.js";
import { serializeOrganization } from "./serializers.js";

export const organizationsRouter = new Hono<AppEnv>();

organizationsRouter.post("/organizations", validate("json", createOrganizationSchema), async (c) => {
  const { name } = c.req.valid("json");
  const [record] = await c.var.db.insert(organizations).values({ name }).returning();
  if (!record) {
    throw new Error("Insert returned no organization");
  }

  return c.json(serializeOrganization(record), 201);
});
