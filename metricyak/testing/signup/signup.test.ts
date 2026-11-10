import { createHash } from "node:crypto";
import { afterEach, describe, expect, vi } from "vitest";
import { signupResponseSchema, type UserResponse } from "@/api/signup/schemas.js";
import type { Database } from "@/db/index.js";
import { organizationMemberships } from "@/db/schema/organization-memberships.js";
import { type OrganizationRecord, organizations } from "@/db/schema/organizations.js";
import { type ProjectRecord, projects } from "@/db/schema/projects.js";
import { sessions } from "@/db/schema/sessions.js";
import { userSelections } from "@/db/schema/user-selections.js";
import { users } from "@/db/schema/users.js";
import { createTestApp, post, sessionCookieToken, sessionService, test } from "../fixtures.js";

const signup = {
  name: "Yak Herder",
  email: "herder@yak.test",
  password: "shaggy-yak-grazes-moss",
  organization_name: "Yak Ranch",
  heard_about_us: "A friend at the yak fair",
  job_role: "Founder",
};

const weakPasswordNextStep = "Choose something harder to guess.";

async function expectNothingCreated(db: Database): Promise<void> {
  expect(await db.$count(users)).toBe(0);
  expect(await db.$count(organizations)).toBe(0);
  expect(await db.$count(organizationMemberships)).toBe(0);
  expect(await db.$count(projects)).toBe(0);
  expect(await db.$count(userSelections)).toBe(0);
  expect(await db.$count(sessions)).toBe(0);
}

type ExpectedUser = {
  firstName: string;
  lastName: string | null;
  isEmailVerified: boolean;
  heardAboutUs: string | null;
};

const expectedUser: ExpectedUser = {
  firstName: "Yak",
  lastName: "Herder",
  isEmailVerified: true,
  heardAboutUs: "A friend at the yak fair",
};

async function expectSignupResponse(
  response: Response,
  now: Date,
  { firstName, lastName, isEmailVerified }: ExpectedUser,
): Promise<UserResponse> {
  expect(response.status).toBe(201);
  const body = signupResponseSchema.parse(await response.json());
  expect(body).toEqual({
    user: {
      id: expect.any(String),
      first_name: firstName,
      last_name: lastName,
      email: "herder@yak.test",
      is_email_verified: isEmailVerified,
      job_role: "Founder",
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
    },
  });
  return body.user;
}

async function expectUserToBeInserted(
  db: Database,
  user: UserResponse,
  now: Date,
  { firstName, lastName, isEmailVerified, heardAboutUs }: ExpectedUser,
): Promise<void> {
  expect(await db.select().from(users)).toEqual([
    {
      id: user.id,
      firstName,
      lastName,
      email: "herder@yak.test",
      passwordHash: expect.stringMatching(/^\$argon2id\$/),
      emailVerifiedAt: isEmailVerified ? now : null,
      heardAboutUs,
      jobRole: "Founder",
      isActive: true,
      createdAt: now,
      updatedAt: now,
    },
  ]);
}

async function expectOrganizationToBeInserted(db: Database, now: Date): Promise<OrganizationRecord> {
  const records = await db.select().from(organizations);
  expect(records).toEqual([
    { id: expect.any(String), name: "Yak Ranch", isActive: true, createdAt: now, updatedAt: now },
  ]);
  return records[0] as OrganizationRecord;
}

async function expectOwnerMembershipToBeInserted(
  db: Database,
  user: UserResponse,
  organization: OrganizationRecord,
  now: Date,
): Promise<void> {
  expect(await db.select().from(organizationMemberships)).toEqual([
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

async function expectDefaultProjectToBeInserted(
  db: Database,
  organization: OrganizationRecord,
  now: Date,
): Promise<ProjectRecord> {
  const records = await db.select().from(projects);
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

async function expectUserSelectionToBeInserted(
  db: Database,
  user: UserResponse,
  project: ProjectRecord,
  now: Date,
): Promise<void> {
  expect(await db.select().from(userSelections)).toEqual([
    { userId: user.id, organizationId: project.organizationId, projectId: project.id, updatedAt: now },
  ]);
}

async function expectSessionToBeCreated(
  db: Database,
  response: Response,
  user: UserResponse,
  now: Date,
): Promise<void> {
  const token = sessionCookieToken(response) as string;
  const expiresAt = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
  expect(response.headers.get("set-cookie")).toBe(
    `__Host-id=${token}; Max-Age=1209600; Path=/; Expires=${expiresAt.toUTCString()}; HttpOnly; Secure; SameSite=Lax`,
  );
  expect(await db.select().from(sessions)).toEqual([
    {
      id: expect.any(String),
      userId: user.id,
      tokenHash: createHash("sha256").update(token).digest("hex"),
      expiresAt,
      createdAt: now,
    },
  ]);
  expect((await sessionService.findUserBySessionToken(db, token, now))?.id).toBe(user.id);
}

async function expectNoSession(db: Database, response: Response): Promise<void> {
  expect(response.headers.get("set-cookie")).toBeNull();
  expect(await db.$count(sessions)).toBe(0);
}

describe("POST /api/signup", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  test("a visitor signs up, lands in their new organization and default project as owner, and is logged in", async ({
    app,
    db,
  }) => {
    const now = new Date("2026-01-01T00:00:00.000Z");
    vi.setSystemTime(now);

    const response = await post(app, "/api/signup", signup);

    const user = await expectSignupResponse(response, now, expectedUser);
    await expectUserToBeInserted(db, user, now, expectedUser);
    const organization = await expectOrganizationToBeInserted(db, now);
    await expectOwnerMembershipToBeInserted(db, user, organization, now);
    const project = await expectDefaultProjectToBeInserted(db, organization, now);
    await expectUserSelectionToBeInserted(db, user, project, now);
    await expectSessionToBeCreated(db, response, user, now);
  });

  test("a visitor signs up while email verification is required and is left unverified and logged out", async ({
    db,
  }) => {
    const now = new Date("2026-01-01T00:00:00.000Z");
    vi.setSystemTime(now);
    const app = createTestApp(db, {
      EMAIL_PROVIDER: "smtp",
      EMAIL_FROM: "MetricYak <hey@yak.test>",
      SMTP_HOST: "localhost",
      EMAIL_VERIFICATION_REQUIRED: "true",
    });

    const response = await post(app, "/api/signup", signup);

    const user = await expectSignupResponse(response, now, { ...expectedUser, isEmailVerified: false });
    await expectUserToBeInserted(db, user, now, { ...expectedUser, isEmailVerified: false });
    const organization = await expectOrganizationToBeInserted(db, now);
    await expectOwnerMembershipToBeInserted(db, user, organization, now);
    const project = await expectDefaultProjectToBeInserted(db, organization, now);
    await expectUserSelectionToBeInserted(db, user, project, now);
    await expectNoSession(db, response);
  });

  test("a visitor signs up without saying where they heard about us", async ({ app, db }) => {
    const now = new Date("2026-01-01T00:00:00.000Z");
    vi.setSystemTime(now);
    const { heard_about_us: _, ...withoutHeardAboutUs } = signup;

    const response = await post(app, "/api/signup", withoutHeardAboutUs);

    const user = await expectSignupResponse(response, now, { ...expectedUser, heardAboutUs: null });
    await expectUserToBeInserted(db, user, now, { ...expectedUser, heardAboutUs: null });
    const organization = await expectOrganizationToBeInserted(db, now);
    await expectOwnerMembershipToBeInserted(db, user, organization, now);
    const project = await expectDefaultProjectToBeInserted(db, organization, now);
    await expectUserSelectionToBeInserted(db, user, project, now);
    await expectSessionToBeCreated(db, response, user, now);
  });

  test("a visitor signs up with a mixed-case, padded email and it is saved lowercased", async ({ app, db }) => {
    const now = new Date("2026-01-01T00:00:00.000Z");
    vi.setSystemTime(now);

    const response = await post(app, "/api/signup", { ...signup, email: "  Herder@YAK.test " });

    const user = await expectSignupResponse(response, now, expectedUser);
    await expectUserToBeInserted(db, user, now, expectedUser);
    const organization = await expectOrganizationToBeInserted(db, now);
    await expectOwnerMembershipToBeInserted(db, user, organization, now);
    const project = await expectDefaultProjectToBeInserted(db, organization, now);
    await expectUserSelectionToBeInserted(db, user, project, now);
    await expectSessionToBeCreated(db, response, user, now);
  });

  test("a visitor signs up with a single-word name and is saved without a last name", async ({ app, db }) => {
    const now = new Date("2026-01-01T00:00:00.000Z");
    vi.setSystemTime(now);

    const response = await post(app, "/api/signup", { ...signup, name: "Yak" });

    const user = await expectSignupResponse(response, now, { ...expectedUser, firstName: "Yak", lastName: null });
    await expectUserToBeInserted(db, user, now, { ...expectedUser, firstName: "Yak", lastName: null });
    const organization = await expectOrganizationToBeInserted(db, now);
    await expectOwnerMembershipToBeInserted(db, user, organization, now);
    const project = await expectDefaultProjectToBeInserted(db, organization, now);
    await expectUserSelectionToBeInserted(db, user, project, now);
    await expectSessionToBeCreated(db, response, user, now);
  });

  test("a visitor signs up with a multi-word surname and it is kept as their last name", async ({ app, db }) => {
    const now = new Date("2026-01-01T00:00:00.000Z");
    vi.setSystemTime(now);

    const response = await post(app, "/api/signup", { ...signup, name: "Yak  van der   Herder" });

    const user = await expectSignupResponse(response, now, {
      ...expectedUser,
      firstName: "Yak",
      lastName: "van der Herder",
    });
    await expectUserToBeInserted(db, user, now, { ...expectedUser, firstName: "Yak", lastName: "van der Herder" });
    const organization = await expectOrganizationToBeInserted(db, now);
    await expectOwnerMembershipToBeInserted(db, user, organization, now);
    const project = await expectDefaultProjectToBeInserted(db, organization, now);
    await expectUserSelectionToBeInserted(db, user, project, now);
    await expectSessionToBeCreated(db, response, user, now);
  });

  test("a visitor cannot sign up with an email that is already registered in a different case", async ({ app, db }) => {
    await post(app, "/api/signup", signup);

    const response = await post(app, "/api/signup", {
      ...signup,
      email: "HERDER@Yak.test",
      organization_name: "Another Ranch",
    });

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      errors: [
        {
          error_type: "invalid_request",
          error_code: "email_taken",
          detail: "An account with this email already exists.",
          param: null,
        },
      ],
    });
    expect(await db.$count(users)).toBe(1);
    expect(await db.$count(organizations)).toBe(1);
    expect(await db.$count(organizationMemberships)).toBe(1);
    expect(await db.$count(projects)).toBe(1);
    expect(await db.$count(userSelections)).toBe(1);
    expect(await db.$count(sessions)).toBe(1);
  });

  test.for([
    {
      case: "a blank name",
      field: "name",
      value: "  ",
      code: "too_small",
      detail: "The field should have at least 1 character",
    },
    {
      case: "a name longer than 150 characters",
      field: "name",
      value: "a".repeat(151),
      code: "too_big",
      detail: "The field should have no more than 150 characters.",
    },
    {
      case: "an invalid email",
      field: "email",
      value: "not-an-email",
      code: "invalid_format",
      detail: "The field should be a valid email address.",
    },
    {
      case: "an email longer than 254 characters",
      field: "email",
      value: `${"a".repeat(246)}@yak.test`,
      code: "too_big",
      detail: "The field should have no more than 254 characters.",
    },
    {
      case: "a password shorter than 8 characters",
      field: "password",
      value: "short",
      code: "too_small",
      detail: "The field should have at least 8 characters",
    },
    {
      case: "a password longer than 128 characters",
      field: "password",
      value: "a".repeat(129),
      code: "too_big",
      detail: "The field should have no more than 128 characters.",
    },
    {
      case: "a blank organization name",
      field: "organization_name",
      value: "  ",
      code: "too_small",
      detail: "The field should have at least 1 character",
    },
    {
      case: "an organization name longer than 72 characters",
      field: "organization_name",
      value: "a".repeat(73),
      code: "too_big",
      detail: "The field should have no more than 72 characters.",
    },
    {
      case: "a blank heard about us",
      field: "heard_about_us",
      value: "  ",
      code: "too_small",
      detail: "The field should have at least 1 character",
    },
    {
      case: "a heard about us longer than 255 characters",
      field: "heard_about_us",
      value: "a".repeat(256),
      code: "too_big",
      detail: "The field should have no more than 255 characters.",
    },
    {
      case: "no job role",
      field: "job_role",
      value: undefined,
      code: "invalid_type",
      detail: "Invalid input: expected string, received undefined",
    },
    {
      case: "a blank job role",
      field: "job_role",
      value: "  ",
      code: "too_small",
      detail: "The field should have at least 1 character",
    },
    {
      case: "a job role longer than 100 characters",
      field: "job_role",
      value: "a".repeat(101),
      code: "too_big",
      detail: "The field should have no more than 100 characters.",
    },
  ])("a visitor cannot sign up with $case", async ({ field, value, code, detail }, { app, db }) => {
    const response = await post(app, "/api/signup", { ...signup, [field]: value });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      errors: [{ error_type: "invalid_request", error_code: code, detail, param: field }],
    });
    await expectNothingCreated(db);
  });

  test.for([
    {
      case: "a common password",
      password: "password1",
      detail: `This is a commonly used password. ${weakPasswordNextStep}`,
    },
    {
      case: "a keyboard-pattern password",
      password: "qwertyuiop",
      detail: `This is a frequently used password. ${weakPasswordNextStep}`,
    },
    {
      case: "a password made from their own details",
      password: "herder123456",
      detail: `There should not be any personal or page related data. ${weakPasswordNextStep}`,
    },
    {
      case: "a guessable password that has no specific warning",
      password: "grazingyak",
      detail: `This password isn't strong enough. ${weakPasswordNextStep}`,
    },
  ])("a visitor cannot sign up with $case", async ({ password, detail }, { app, db }) => {
    const response = await post(app, "/api/signup", { ...signup, password });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      errors: [{ error_type: "invalid_request", error_code: "password_too_weak", detail, param: "password" }],
    });
    await expectNothingCreated(db);
  });
});
