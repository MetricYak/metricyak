import { Hono } from "hono";
import { organizationMemberships } from "@/db/schema/organization-memberships.js";
import { organizations } from "@/db/schema/organizations.js";
import { projects } from "@/db/schema/projects.js";
import { userSelections } from "@/db/schema/user-selections.js";
import { users } from "@/db/schema/users.js";
import { ConflictError, ValidationError } from "@/errors/index.js";
import type { AppEnv } from "../env.js";
import { setSessionCookie } from "../session-cookie.js";
import { validate } from "../validator.js";
import { signupSchema } from "./schemas.js";
import { serializeUser } from "./serializers.js";

const WEAK_PASSWORD_WARNING = "This password isn't strong enough.";
const WEAK_PASSWORD_NEXT_STEP = "Choose something harder to guess.";

export const signupRouter = new Hono<AppEnv>();

function splitName(name: string): { firstName: string; lastName: string | null } {
  const [firstName = "", ...rest] = name.split(/\s+/);
  return { firstName, lastName: rest.length > 0 ? rest.join(" ") : null };
}

signupRouter.post("/signup", validate("json", signupSchema), async (c) => {
  const request = c.req.valid("json");

  const strength = c.var.passwordService.checkPasswordStrength(request.password, [
    request.name,
    request.email,
    request.organization_name,
  ]);
  if (!strength.isStrong) {
    throw new ValidationError([
      {
        code: "password_too_weak",
        detail: `${strength.warning ?? WEAK_PASSWORD_WARNING} ${WEAK_PASSWORD_NEXT_STEP}`,
        param: "password",
      },
    ]);
  }

  const passwordHash = await c.var.passwordService.hashPassword(request.password);
  const { firstName, lastName } = splitName(request.name);
  const now = new Date();

  const { user, session } = await c.var.db.transaction(async (tx) => {
    const [user] = await tx
      .insert(users)
      .values({
        firstName,
        lastName,
        email: request.email,
        passwordHash,
        emailVerifiedAt: c.var.config.email.verificationRequired ? null : now,
        heardAboutUs: request.heard_about_us ?? null,
        jobRole: request.job_role,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoNothing({ target: users.email })
      .returning();

    if (!user) {
      throw new ConflictError({ code: "email_taken", detail: "An account with this email already exists." });
    }

    const [organization] = await tx
      .insert(organizations)
      .values({ name: request.organization_name, createdAt: now, updatedAt: now })
      .returning();
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

    await tx
      .insert(userSelections)
      .values({ userId: user.id, organizationId: organization.id, projectId: project.id, updatedAt: now });

    const session = c.var.config.email.verificationRequired
      ? null
      : await c.var.sessionService.createSession(tx, user.id, now);

    return { user, session };
  });

  if (session) {
    setSessionCookie(c, session);
  }

  return c.json({ user: serializeUser(user) }, 201);
});
