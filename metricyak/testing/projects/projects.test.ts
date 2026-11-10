import type { Hono } from "hono";
import { afterEach, beforeEach, describe, expect, vi } from "vitest";
import type { AppEnv } from "@/api/env.js";
import { projectResponseSchema } from "@/api/projects/schemas.js";
import type { Database } from "@/db/index.js";
import { type MembershipRole, organizationMemberships } from "@/db/schema/organization-memberships.js";
import { type OrganizationRecord, organizations } from "@/db/schema/organizations.js";
import { projects } from "@/db/schema/projects.js";
import { type UserRecord, users } from "@/db/schema/users.js";
import { post, type RequestOptions, sessionService, test } from "../fixtures.js";

const now = new Date("2026-01-01T00:00:00.000Z");
const lastYear = new Date("2025-01-01T00:00:00.000Z");
const unknownOrganizationId = "019a5f00-0000-7000-8000-000000000000";

async function givenAUser(db: Database): Promise<UserRecord> {
  const [user] = await db
    .insert(users)
    .values({
      firstName: "Yak",
      lastName: "Herder",
      email: "herder@yak.test",
      passwordHash: null,
      emailVerifiedAt: lastYear,
      createdAt: lastYear,
      updatedAt: lastYear,
    })
    .returning();
  if (!user) {
    throw new Error("Insert returned no user");
  }
  return user;
}

async function givenAnOrganization(db: Database, { isActive = true } = {}): Promise<OrganizationRecord> {
  const [organization] = await db
    .insert(organizations)
    .values({ name: "Yak Herders", isActive, createdAt: lastYear, updatedAt: lastYear })
    .returning();
  if (!organization) {
    throw new Error("Insert returned no organization");
  }
  return organization;
}

async function givenTheyAre(
  db: Database,
  role: MembershipRole,
  user: UserRecord,
  organization: OrganizationRecord,
): Promise<void> {
  await db.insert(organizationMemberships).values({
    organizationId: organization.id,
    userId: user.id,
    role,
    createdAt: lastYear,
    updatedAt: lastYear,
  });
}

async function givenTheyAreLoggedIn(db: Database, user: UserRecord): Promise<string> {
  return (await sessionService.createSession(db, user.id, now)).token;
}

async function whenTheyCreateAProject(
  app: Hono<AppEnv>,
  organizationId: string,
  name: unknown,
  options: RequestOptions = {},
): Promise<Response> {
  return post(app, `/api/organizations/${organizationId}/projects`, { name }, options);
}

async function thenTheProjectIsCreated(
  db: Database,
  response: Response,
  organization: OrganizationRecord,
  name: string,
): Promise<void> {
  expect(response.status).toBe(201);
  const body = projectResponseSchema.parse(await response.json());
  expect(body).toEqual({
    id: expect.any(String),
    name,
    is_active: true,
    created_at: now.toISOString(),
    updated_at: now.toISOString(),
  });
  expect(await db.select().from(projects)).toEqual([
    { id: body.id, organizationId: organization.id, name, isActive: true, createdAt: now, updatedAt: now },
  ]);
}

async function thenTheRequestIsRejected(
  db: Database,
  response: Response,
  status: number,
  error: { error_code: string; detail: string; param?: string },
): Promise<void> {
  expect(response.status).toBe(status);
  expect(await response.json()).toEqual({
    errors: [{ error_type: "invalid_request", param: null, ...error }],
  });
  expect(await db.$count(projects)).toBe(0);
}

const organizationNotFound = { error_code: "organization_not_found", detail: "Organization was not found" };

describe("POST /api/organizations/:organization_id/projects", () => {
  beforeEach(() => {
    vi.setSystemTime(now);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test.for<{ role: MembershipRole }>([{ role: "owner" }, { role: "admin" }])(
    "an organization $role creates a project",
    async ({ role }, { app, db }) => {
      const user = await givenAUser(db);
      const organization = await givenAnOrganization(db);
      await givenTheyAre(db, role, user, organization);
      const token = await givenTheyAreLoggedIn(db, user);

      const response = await whenTheyCreateAProject(app, organization.id, "The Yaks", { token });

      await thenTheProjectIsCreated(db, response, organization, "The Yaks");
    },
  );

  test("an owner creates a project with a 216 character name padded with whitespace", async ({ app, db }) => {
    const user = await givenAUser(db);
    const organization = await givenAnOrganization(db);
    await givenTheyAre(db, "owner", user, organization);
    const token = await givenTheyAreLoggedIn(db, user);

    const response = await whenTheyCreateAProject(app, organization.id, ` ${"a".repeat(216)} `, { token });

    await thenTheProjectIsCreated(db, response, organization, "a".repeat(216));
  });

  test("an organization member cannot create a project", async ({ app, db }) => {
    const user = await givenAUser(db);
    const organization = await givenAnOrganization(db);
    await givenTheyAre(db, "member", user, organization);
    const token = await givenTheyAreLoggedIn(db, user);

    const response = await whenTheyCreateAProject(app, organization.id, "The Yaks", { token });

    await thenTheRequestIsRejected(db, response, 403, {
      error_code: "permission_denied",
      detail: "You don't have permission to do this.",
    });
  });

  test("a user cannot create a project in an organization they don't belong to", async ({ app, db }) => {
    const user = await givenAUser(db);
    const organization = await givenAnOrganization(db);
    const token = await givenTheyAreLoggedIn(db, user);

    const response = await whenTheyCreateAProject(app, organization.id, "The Yaks", { token });

    await thenTheRequestIsRejected(db, response, 404, organizationNotFound);
  });

  test("a user cannot create a project in an organization that doesn't exist", async ({ app, db }) => {
    const user = await givenAUser(db);
    const token = await givenTheyAreLoggedIn(db, user);

    const response = await whenTheyCreateAProject(app, unknownOrganizationId, "The Yaks", { token });

    await thenTheRequestIsRejected(db, response, 404, organizationNotFound);
  });

  test("an owner cannot create a project in a deactivated organization", async ({ app, db }) => {
    const user = await givenAUser(db);
    const organization = await givenAnOrganization(db, { isActive: false });
    await givenTheyAre(db, "owner", user, organization);
    const token = await givenTheyAreLoggedIn(db, user);

    const response = await whenTheyCreateAProject(app, organization.id, "The Yaks", { token });

    await thenTheRequestIsRejected(db, response, 404, organizationNotFound);
  });

  test("a user cannot create a project with an organization id that is not a uuid", async ({ app, db }) => {
    const user = await givenAUser(db);
    const token = await givenTheyAreLoggedIn(db, user);

    const response = await whenTheyCreateAProject(app, "yak", "The Yaks", { token });

    await thenTheRequestIsRejected(db, response, 400, {
      error_code: "invalid_format",
      detail: "The field should be a valid UUID.",
      param: "organization_id",
    });
  });

  test("a visitor without a session cannot create a project", async ({ app, db }) => {
    const organization = await givenAnOrganization(db);

    const response = await whenTheyCreateAProject(app, organization.id, "The Yaks");

    await thenTheRequestIsRejected(db, response, 401, {
      error_code: "not_authenticated",
      detail: "Authentication required.",
    });
  });

  test.for([
    {
      case: "longer than 216 characters",
      name: "a".repeat(217),
      code: "too_big",
      detail: "The field should have no more than 216 characters.",
    },
    {
      case: "longer than 216 characters after trimming",
      name: ` ${"a".repeat(217)} `,
      code: "too_big",
      detail: "The field should have no more than 216 characters.",
    },
    { case: "empty", name: "", code: "too_small", detail: "The field should have at least 1 character" },
    { case: "only whitespace", name: "   ", code: "too_small", detail: "The field should have at least 1 character" },
    { case: "null", name: null, code: "invalid_type", detail: "Invalid input: expected string, received null" },
  ])("an owner cannot create a project with a name that is $case", async ({ name, code, detail }, { app, db }) => {
    const user = await givenAUser(db);
    const organization = await givenAnOrganization(db);
    await givenTheyAre(db, "owner", user, organization);
    const token = await givenTheyAreLoggedIn(db, user);

    const response = await whenTheyCreateAProject(app, organization.id, name, { token });

    await thenTheRequestIsRejected(db, response, 400, { error_code: code, detail, param: "name" });
  });
});
