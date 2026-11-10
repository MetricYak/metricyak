import { and, eq } from "drizzle-orm";
import { createMiddleware } from "hono/factory";
import { type MembershipRole, organizationMemberships } from "@/db/schema/organization-memberships.js";
import { organizations } from "@/db/schema/organizations.js";
import { ForbiddenError, NotFoundError } from "@/errors/index.js";
import type { OrganizationEnv } from "../env.js";

export function requireOrganizationMember(...roles: MembershipRole[]) {
  return createMiddleware<OrganizationEnv>(async (c, next) => {
    const [row] = await c.var.db
      .select({ organization: organizations, membership: organizationMemberships })
      .from(organizations)
      .innerJoin(organizationMemberships, eq(organizationMemberships.organizationId, organizations.id))
      .where(
        and(
          eq(organizations.id, c.req.param("organization_id") ?? ""),
          eq(organizations.isActive, true),
          eq(organizationMemberships.userId, c.var.user.id),
        ),
      );

    if (!row) {
      throw new NotFoundError({ code: "organization_not_found", detail: "Organization was not found" });
    }
    if (roles.length > 0 && !roles.includes(row.membership.role)) {
      throw new ForbiddenError();
    }

    c.set("organization", row.organization);
    c.set("membership", row.membership);
    await next();
  });
}
