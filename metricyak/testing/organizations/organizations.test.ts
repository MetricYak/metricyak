import { eq } from "drizzle-orm";
import type { Hono } from "hono";
import { afterEach, beforeEach, describe, expect, vi } from "vitest";
import type { AppEnv } from "@/api/env.js";
import { type OrganizationResponse, organizationResponseSchema } from "@/api/organizations/schemas.js";
import type { Database } from "@/db/index.js";
import { organizationMemberships } from "@/db/schema/organization-memberships.js";
import { type OrganizationRecord, organizations } from "@/db/schema/organizations.js";
import { type ProjectRecord, projects } from "@/db/schema/projects.js";
import { type UserSelectionRecord, userSelections } from "@/db/schema/user-selections.js";
import { type UserRecord, users } from "@/db/schema/users.js";
import { post, type RequestOptions, sessionService, test } from "../fixtures.js";

const now = new Date("2026-01-01T00:00:00.000Z");
const lastYear = new Date("2025-01-01T00:00:00.000Z");

async function givenAUser(db: Database, { isActive = true } = {}): Promise<UserRecord> {
  const [user] = await db
    .insert(users)
    .values({
      firstName: "Yak",
      lastName: "Herder",
      email: "herder@yak.test",
      passwordHash: null,
      emailVerifiedAt: lastYear,
      isActive,
      createdAt: lastYear,
      updatedAt: lastYear,
    })
    .returning();
  if (!user) {
    throw new Error("Insert returned no user");
  }
  return user;
}

async function givenTheyOwnAnOrganization(db: Database, user: UserRecord): Promise<OrganizationRecord> {
  const [organization] = await db
    .insert(organizations)
    .values({ name: "Yak Herders", createdAt: lastYear, updatedAt: lastYear })
    .returning();
  if (!organization) {
    throw new Error("Insert returned no organization");
  }
  await db.insert(organizationMemberships).values({
    organizationId: organization.id,
    userId: user.id,
    role: "owner",
    createdAt: lastYear,
    updatedAt: lastYear,
  });
  return organization;
}

async function givenItIsTheirCurrentOrganization(
  db: Database,
  user: UserRecord,
  organization: OrganizationRecord,
): Promise<UserSelectionRecord> {
  const [project] = await db
    .insert(projects)
    .values({ organizationId: organization.id, name: "Yak Pasture", createdAt: lastYear, updatedAt: lastYear })
    .returning();
  if (!project) {
    throw new Error("Insert returned no project");
  }
  const [selection] = await db
    .insert(userSelections)
    .values({ userId: user.id, organizationId: organization.id, projectId: project.id, updatedAt: lastYear })
    .returning();
  if (!selection) {
    throw new Error("Insert returned no user selection");
  }
  return selection;
}

async function givenTheyAreLoggedIn(db: Database, user: UserRecord, at: Date = now): Promise<string> {
  return (await sessionService.createSession(db, user.id, at)).token;
}

async function whenTheyCreateAnOrganization(
  app: Hono<AppEnv>,
  name: unknown,
  options: RequestOptions = {},
): Promise<Response> {
  return post(app, "/api/organizations", { name }, options);
}

async function thenTheOrganizationIsCreated(response: Response, name: string): Promise<OrganizationResponse> {
  expect(response.status).toBe(201);
  const body = organizationResponseSchema.parse(await response.json());
  expect(body).toEqual({
    id: expect.any(String),
    name,
    is_active: true,
    created_at: now.toISOString(),
    updated_at: now.toISOString(),
  });
  return body;
}

async function thenTheOrganizationIsStored(db: Database, organization: OrganizationResponse): Promise<void> {
  expect(await db.select().from(organizations).where(eq(organizations.id, organization.id))).toEqual([
    { id: organization.id, name: organization.name, isActive: true, createdAt: now, updatedAt: now },
  ]);
}

async function thenTheyAreItsOwner(db: Database, user: UserRecord, organization: OrganizationResponse): Promise<void> {
  expect(
    await db.select().from(organizationMemberships).where(eq(organizationMemberships.organizationId, organization.id)),
  ).toEqual([
    {
      id: expect.any(String),
      organizationId: organization.id,
      userId: user.id,
      role: "owner",
      createdAt: now,
      updatedAt: now,
    },
  ]);
}

async function thenItHasADefaultProject(db: Database, organization: OrganizationResponse): Promise<ProjectRecord> {
  const records = await db.select().from(projects).where(eq(projects.organizationId, organization.id));
  expect(records).toEqual([
    {
      id: expect.any(String),
      organizationId: organization.id,
      name: "Default project",
      isActive: true,
      createdAt: now,
      updatedAt: now,
    },
  ]);
  return records[0] as ProjectRecord;
}

async function thenTheirCurrentSelectionIs(db: Database, selection: UserSelectionRecord): Promise<void> {
  expect(await db.select().from(userSelections)).toEqual([selection]);
}

async function thenTheRequestIsRejected(
  db: Database,
  response: Response,
  status: number,
  error: { error_code: string; detail: string },
): Promise<void> {
  expect(response.status).toBe(status);
  expect(await response.json()).toEqual({ errors: [{ error_type: "invalid_request", ...error, param: null }] });
  expect(await db.$count(organizations, eq(organizations.createdAt, now))).toBe(0);
}

const notAuthenticated = { error_code: "not_authenticated", detail: "Authentication required." };
const crossOrigin = { error_code: "permission_denied", detail: "Cross-origin requests are not allowed." };

describe("POST /api/organizations", () => {
  beforeEach(() => {
    vi.setSystemTime(now);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test("a logged-in user creates an organization, becomes its owner and keeps their current organization", async ({
    app,
    db,
  }) => {
    const user = await givenAUser(db);
    const currentOrganization = await givenTheyOwnAnOrganization(db, user);
    const selection = await givenItIsTheirCurrentOrganization(db, user, currentOrganization);
    const token = await givenTheyAreLoggedIn(db, user);

    const response = await whenTheyCreateAnOrganization(app, "Yak Shavers", { token });

    const organization = await thenTheOrganizationIsCreated(response, "Yak Shavers");
    await thenTheOrganizationIsStored(db, organization);
    await thenTheyAreItsOwner(db, user, organization);
    await thenItHasADefaultProject(db, organization);
    await thenTheirCurrentSelectionIs(db, selection);
  });

  test("a logged-in user with no current organization creates one and it becomes their current organization", async ({
    app,
    db,
  }) => {
    const user = await givenAUser(db);
    await givenTheyOwnAnOrganization(db, user);
    const token = await givenTheyAreLoggedIn(db, user);

    const response = await whenTheyCreateAnOrganization(app, "Yak Shavers", { token });

    const organization = await thenTheOrganizationIsCreated(response, "Yak Shavers");
    await thenTheOrganizationIsStored(db, organization);
    await thenTheyAreItsOwner(db, user, organization);
    const project = await thenItHasADefaultProject(db, organization);
    await thenTheirCurrentSelectionIs(db, {
      userId: user.id,
      organizationId: organization.id,
      projectId: project.id,
      updatedAt: now,
    });
  });

  test("a visitor without a session cannot create an organization", async ({ app, db }) => {
    const response = await whenTheyCreateAnOrganization(app, "Yak Shavers");

    await thenTheRequestIsRejected(db, response, 401, notAuthenticated);
  });

  test("a visitor with an unknown session cannot create an organization", async ({ app, db }) => {
    const response = await whenTheyCreateAnOrganization(app, "Yak Shavers", { token: "unknown-yak-token" });

    await thenTheRequestIsRejected(db, response, 401, notAuthenticated);
  });

  test("a user whose session has expired cannot create an organization", async ({ app, db }) => {
    const user = await givenAUser(db);
    await givenTheyOwnAnOrganization(db, user);
    const token = await givenTheyAreLoggedIn(db, user, lastYear);

    const response = await whenTheyCreateAnOrganization(app, "Yak Shavers", { token });

    await thenTheRequestIsRejected(db, response, 401, notAuthenticated);
  });

  test("a deactivated user cannot create an organization", async ({ app, db }) => {
    const user = await givenAUser(db, { isActive: false });
    await givenTheyOwnAnOrganization(db, user);
    const token = await givenTheyAreLoggedIn(db, user);

    const response = await whenTheyCreateAnOrganization(app, "Yak Shavers", { token });

    await thenTheRequestIsRejected(db, response, 401, notAuthenticated);
  });

  test.for([
    { case: "from a cross-site page", headers: { "sec-fetch-site": "cross-site" } },
    { case: "from a page on another subdomain", headers: { "sec-fetch-site": "same-site" } },
    { case: "from a cross-site page in a browser without Fetch Metadata", headers: { origin: "https://evil.test" } },
    { case: "from a sandboxed page in a browser without Fetch Metadata", headers: { origin: "null" } },
    { case: "from a page that sends no origin headers", headers: {} },
  ])(
    "a logged-in user cannot be made to submit a form that creates an organization $case",
    async ({ headers }, { app, db }) => {
      const user = await givenAUser(db);
      await givenTheyOwnAnOrganization(db, user);
      const token = await givenTheyAreLoggedIn(db, user);

      const response = await whenTheyCreateAnOrganization(app, "Yak Shavers", {
        token,
        headers: { "content-type": "application/x-www-form-urlencoded", ...headers },
      });

      await thenTheRequestIsRejected(db, response, 403, crossOrigin);
    },
  );

  test.for([
    {
      case: "longer than 72 characters",
      name: "a".repeat(73),
      code: "too_big",
      detail: "The field should have no more than 72 characters.",
    },
    {
      case: "longer than 72 characters after trimming",
      name: ` ${"a".repeat(73)} `,
      code: "too_big",
      detail: "The field should have no more than 72 characters.",
    },
    { case: "empty", name: "", code: "too_small", detail: "The field should have at least 1 character" },
    { case: "only whitespace", name: "   ", code: "too_small", detail: "The field should have at least 1 character" },
    { case: "null", name: null, code: "invalid_type", detail: "Invalid input: expected string, received null" },
  ])(
    "a logged-in user cannot create an organization with a name that is $case",
    async ({ name, code, detail }, { app, db }) => {
      const user = await givenAUser(db);
      await givenTheyOwnAnOrganization(db, user);
      const token = await givenTheyAreLoggedIn(db, user);

      const response = await whenTheyCreateAnOrganization(app, name, { token });

      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({
        errors: [{ error_type: "invalid_request", error_code: code, detail, param: "name" }],
      });
      expect(await db.$count(organizations)).toBe(1);
    },
  );
});
