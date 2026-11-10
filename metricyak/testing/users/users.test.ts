import { and, eq } from "drizzle-orm";
import type { Hono } from "hono";
import { afterEach, beforeEach, describe, expect, vi } from "vitest";
import type { AppEnv } from "@/api/env.js";
import { getCurrentUserResponseSchema } from "@/api/users/schemas.js";
import type { Database } from "@/db/index.js";
import { organizationMemberships } from "@/db/schema/organization-memberships.js";
import { type OrganizationRecord, organizations } from "@/db/schema/organizations.js";
import { type ProjectRecord, projects } from "@/db/schema/projects.js";
import { type UserSelectionRecord, userSelections } from "@/db/schema/user-selections.js";
import { type UserRecord, users } from "@/db/schema/users.js";
import { get, type RequestOptions, sessionService, test } from "../fixtures.js";

const now = new Date("2026-01-01T00:00:00.000Z");
const lastYear = new Date("2025-01-01T00:00:00.000Z");

async function givenAUser(
  db: Database,
  { isActive = true, emailVerifiedAt = lastYear as Date | null } = {},
): Promise<UserRecord> {
  const [user] = await db
    .insert(users)
    .values({
      firstName: "Yak",
      lastName: "Herder",
      email: "herder@yak.test",
      passwordHash: null,
      emailVerifiedAt,
      jobRole: "Founder",
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

async function givenItHasAProject(db: Database, organization: OrganizationRecord): Promise<ProjectRecord> {
  const [project] = await db
    .insert(projects)
    .values({ organizationId: organization.id, name: "Yak Pasture", createdAt: lastYear, updatedAt: lastYear })
    .returning();
  if (!project) {
    throw new Error("Insert returned no project");
  }
  return project;
}

async function givenItIsTheirCurrentProject(
  db: Database,
  user: UserRecord,
  project: ProjectRecord,
): Promise<UserSelectionRecord> {
  const [selection] = await db
    .insert(userSelections)
    .values({ userId: user.id, organizationId: project.organizationId, projectId: project.id, updatedAt: lastYear })
    .returning();
  if (!selection) {
    throw new Error("Insert returned no user selection");
  }
  return selection;
}

async function givenTheOrganizationIsDeactivated(db: Database, organization: OrganizationRecord): Promise<void> {
  await db.update(organizations).set({ isActive: false }).where(eq(organizations.id, organization.id));
}

async function givenTheProjectIsDeactivated(db: Database, project: ProjectRecord): Promise<void> {
  await db.update(projects).set({ isActive: false }).where(eq(projects.id, project.id));
}

async function givenTheyLeftTheOrganization(
  db: Database,
  user: UserRecord,
  organization: OrganizationRecord,
): Promise<void> {
  await db
    .delete(organizationMemberships)
    .where(
      and(eq(organizationMemberships.organizationId, organization.id), eq(organizationMemberships.userId, user.id)),
    );
}

async function givenTheyAreLoggedIn(db: Database, user: UserRecord, at: Date = now): Promise<string> {
  return (await sessionService.createSession(db, user.id, at)).token;
}

async function whenTheyGetThemselves(app: Hono<AppEnv>, options: RequestOptions = {}): Promise<Response> {
  return get(app, "/api/users/@me", options);
}

async function thenTheyGetThemselvesBack(
  response: Response,
  user: UserRecord,
  current: { organizationId: string | null; projectId: string | null },
  { isEmailVerified = true } = {},
): Promise<void> {
  expect(response.status).toBe(200);
  expect(getCurrentUserResponseSchema.parse(await response.json())).toEqual({
    user: {
      id: user.id,
      first_name: "Yak",
      last_name: "Herder",
      email: "herder@yak.test",
      is_email_verified: isEmailVerified,
      job_role: "Founder",
      current_organization_id: current.organizationId,
      current_project_id: current.projectId,
      created_at: lastYear.toISOString(),
      updated_at: lastYear.toISOString(),
    },
  });
}

async function thenTheirSelectionsAre(db: Database, selections: UserSelectionRecord[]): Promise<void> {
  expect(await db.select().from(userSelections)).toEqual(selections);
}

async function thenTheRequestIsRejected(
  response: Response,
  status: number,
  error: { error_code: string; detail: string },
): Promise<void> {
  expect(response.status).toBe(status);
  expect(await response.json()).toEqual({ errors: [{ error_type: "invalid_request", ...error, param: null }] });
}

const notAuthenticated = { error_code: "not_authenticated", detail: "Authentication required." };

describe("GET /api/users/@me", () => {
  beforeEach(() => {
    vi.setSystemTime(now);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test("a logged-in user gets themselves back with their current organization and project", async ({ app, db }) => {
    const user = await givenAUser(db);
    const organization = await givenTheyOwnAnOrganization(db, user);
    const project = await givenItHasAProject(db, organization);
    const selection = await givenItIsTheirCurrentProject(db, user, project);
    const token = await givenTheyAreLoggedIn(db, user);

    const response = await whenTheyGetThemselves(app, { token });

    await thenTheyGetThemselvesBack(response, user, { organizationId: organization.id, projectId: project.id });
    await thenTheirSelectionsAre(db, [selection]);
  });

  test("a logged-in user with no current organization gets themselves back without one", async ({ app, db }) => {
    const user = await givenAUser(db);
    const token = await givenTheyAreLoggedIn(db, user);

    const response = await whenTheyGetThemselves(app, { token });

    await thenTheyGetThemselvesBack(response, user, { organizationId: null, projectId: null });
    await thenTheirSelectionsAre(db, []);
  });

  test("a logged-in user who has not verified their email gets themselves back as unverified", async ({ app, db }) => {
    const user = await givenAUser(db, { emailVerifiedAt: null });
    const token = await givenTheyAreLoggedIn(db, user);

    const response = await whenTheyGetThemselves(app, { token });

    await thenTheyGetThemselvesBack(
      response,
      user,
      { organizationId: null, projectId: null },
      { isEmailVerified: false },
    );
    await thenTheirSelectionsAre(db, []);
  });

  test("a logged-in user who left their current organization gets neither it nor its project", async ({ app, db }) => {
    const user = await givenAUser(db);
    const organization = await givenTheyOwnAnOrganization(db, user);
    const project = await givenItHasAProject(db, organization);
    await givenItIsTheirCurrentProject(db, user, project);
    await givenTheyLeftTheOrganization(db, user, organization);
    const token = await givenTheyAreLoggedIn(db, user);

    const response = await whenTheyGetThemselves(app, { token });

    await thenTheyGetThemselvesBack(response, user, { organizationId: null, projectId: null });
    await thenTheirSelectionsAre(db, []);
  });

  test("a logged-in user whose current organization was deactivated gets neither it nor its project", async ({
    app,
    db,
  }) => {
    const user = await givenAUser(db);
    const organization = await givenTheyOwnAnOrganization(db, user);
    const project = await givenItHasAProject(db, organization);
    const selection = await givenItIsTheirCurrentProject(db, user, project);
    await givenTheOrganizationIsDeactivated(db, organization);
    const token = await givenTheyAreLoggedIn(db, user);

    const response = await whenTheyGetThemselves(app, { token });

    await thenTheyGetThemselvesBack(response, user, { organizationId: null, projectId: null });
    await thenTheirSelectionsAre(db, [selection]);
  });

  test("a logged-in user whose current project was deactivated keeps their organization but not the project", async ({
    app,
    db,
  }) => {
    const user = await givenAUser(db);
    const organization = await givenTheyOwnAnOrganization(db, user);
    const project = await givenItHasAProject(db, organization);
    const selection = await givenItIsTheirCurrentProject(db, user, project);
    await givenTheProjectIsDeactivated(db, project);
    const token = await givenTheyAreLoggedIn(db, user);

    const response = await whenTheyGetThemselves(app, { token });

    await thenTheyGetThemselvesBack(response, user, { organizationId: organization.id, projectId: null });
    await thenTheirSelectionsAre(db, [selection]);
  });

  test("a visitor without a session is not authenticated", async ({ app }) => {
    const response = await whenTheyGetThemselves(app);

    await thenTheRequestIsRejected(response, 401, notAuthenticated);
  });

  test("a visitor with an unknown session is not authenticated", async ({ app }) => {
    const response = await whenTheyGetThemselves(app, { token: "unknown-yak-token" });

    await thenTheRequestIsRejected(response, 401, notAuthenticated);
  });

  test("a user whose session has expired is not authenticated", async ({ app, db }) => {
    const user = await givenAUser(db);
    const token = await givenTheyAreLoggedIn(db, user, lastYear);

    const response = await whenTheyGetThemselves(app, { token });

    await thenTheRequestIsRejected(response, 401, notAuthenticated);
  });

  test("a deactivated user is not authenticated", async ({ app, db }) => {
    const user = await givenAUser(db, { isActive: false });
    const token = await givenTheyAreLoggedIn(db, user);

    const response = await whenTheyGetThemselves(app, { token });

    await thenTheRequestIsRejected(response, 401, notAuthenticated);
  });
});
