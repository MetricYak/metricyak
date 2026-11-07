import { createHash } from "node:crypto";
import { afterEach, describe, expect, vi } from "vitest";
import { loginResponseSchema } from "@/api/login/schemas.js";
import { createPasswordService } from "@/auth/password-service.js";
import type { Database } from "@/db/index.js";
import { sessions } from "@/db/schema/sessions.js";
import { type UserRecord, users } from "@/db/schema/users.js";
import { createTestApp, post, sessionCookieToken, sessionService, test } from "../fixtures.js";

const password = "shaggy-yak-grazes-moss";
const passwordService = createPasswordService();
const now = new Date("2026-01-01T00:00:00.000Z");
const sessionExpiresAt = new Date("2026-01-15T00:00:00.000Z");

const verificationRequiredEnv = {
  EMAIL_PROVIDER: "smtp",
  EMAIL_FROM: "MetricYak <hey@yak.test>",
  SMTP_HOST: "localhost",
  EMAIL_VERIFICATION_REQUIRED: "true",
};

type UserOverrides = Partial<Pick<UserRecord, "passwordHash" | "emailVerifiedAt" | "isActive">>;

async function createUser(db: Database, overrides: UserOverrides = {}): Promise<UserRecord> {
  const [user] = await db
    .insert(users)
    .values({
      firstName: "Yak",
      lastName: "Herder",
      email: "herder@yak.test",
      passwordHash: await passwordService.hashPassword(password),
      emailVerifiedAt: now,
      createdAt: now,
      updatedAt: now,
      ...overrides,
    })
    .returning();
  if (!user) {
    throw new Error("Insert returned no user");
  }
  return user;
}

async function expectLoggedIn(db: Database, response: Response, user: UserRecord): Promise<void> {
  expect(response.status).toBe(200);
  expect(loginResponseSchema.parse(await response.json())).toEqual({
    user: {
      id: user.id,
      first_name: "Yak",
      last_name: "Herder",
      email: "herder@yak.test",
      is_email_verified: user.emailVerifiedAt !== null,
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
    },
  });

  const token = sessionCookieToken(response);
  expect(token).toEqual(expect.any(String));
  expect(response.headers.get("set-cookie")).toBe(
    `metricyak_session=${token}; Max-Age=1209600; Path=/; Expires=${sessionExpiresAt.toUTCString()}; HttpOnly; Secure; SameSite=Lax`,
  );
  expect(await db.select().from(sessions)).toEqual([
    {
      id: expect.any(String),
      userId: user.id,
      tokenHash: createHash("sha256")
        .update(token as string)
        .digest("hex"),
      expiresAt: sessionExpiresAt,
      createdAt: now,
    },
  ]);
  expect(await sessionService.findUserBySessionToken(db, token as string, now)).toEqual(user);
}

describe("POST /api/login", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  test("a verified user logs in and is recognised by their session cookie", async ({ app, db }) => {
    vi.setSystemTime(now);
    const user = await createUser(db);

    const response = await post(app, "/api/login", { email: "herder@yak.test", password });

    await expectLoggedIn(db, response, user);
  });

  test("a user logs in with a mixed-case, padded email", async ({ app, db }) => {
    vi.setSystemTime(now);
    const user = await createUser(db);

    const response = await post(app, "/api/login", { email: "  Herder@YAK.test ", password });

    await expectLoggedIn(db, response, user);
  });

  test("an unverified user logs in when the instance does not require verification", async ({ app, db }) => {
    vi.setSystemTime(now);
    const user = await createUser(db, { emailVerifiedAt: null });

    const response = await post(app, "/api/login", { email: "herder@yak.test", password });

    await expectLoggedIn(db, response, user);
  });

  test("a verified user logs in when the instance requires verification", async ({ db }) => {
    vi.setSystemTime(now);
    const user = await createUser(db);
    const app = createTestApp(db, verificationRequiredEnv);

    const response = await post(app, "/api/login", { email: "herder@yak.test", password });

    await expectLoggedIn(db, response, user);
  });

  test("an unverified user is told to verify their email when the instance requires it", async ({ db }) => {
    await createUser(db, { emailVerifiedAt: null });
    const app = createTestApp(db, verificationRequiredEnv);

    const response = await post(app, "/api/login", { email: "herder@yak.test", password });

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({
      errors: [
        {
          error_type: "invalid_request",
          error_code: "email_not_verified",
          detail: "Verify your email address before logging in.",
          param: null,
        },
      ],
    });
    expect(response.headers.get("set-cookie")).toBeNull();
    expect(await db.$count(sessions)).toBe(0);
  });

  test.for([
    { case: "an unknown email", overrides: {}, email: "shaver@yak.test", password },
    { case: "a wrong password", overrides: {}, email: "herder@yak.test", password: "bald-yak-shivers" },
    { case: "an inactive account", overrides: { isActive: false }, email: "herder@yak.test", password },
    { case: "an account with no password", overrides: { passwordHash: null }, email: "herder@yak.test", password },
  ])("a visitor cannot log in with $case", async ({ overrides, email, password }, { app, db }) => {
    await createUser(db, overrides);

    const response = await post(app, "/api/login", { email, password });

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({
      errors: [
        {
          error_type: "invalid_request",
          error_code: "invalid_credentials",
          detail: "Invalid email or password.",
          param: null,
        },
      ],
    });
    expect(response.headers.get("set-cookie")).toBeNull();
    expect(await db.$count(sessions)).toBe(0);
  });

  test.for([
    {
      case: "no email",
      field: "email",
      value: undefined,
      code: "invalid_type",
      detail: "Invalid input: expected string, received undefined",
    },
    {
      case: "no password",
      field: "password",
      value: undefined,
      code: "invalid_type",
      detail: "Invalid input: expected string, received undefined",
    },
    {
      case: "an empty password",
      field: "password",
      value: "",
      code: "too_small",
      detail: "The field should have at least 1 character",
    },
  ])("a visitor cannot log in with $case", async ({ field, value, code, detail }, { app, db }) => {
    await createUser(db);

    const response = await post(app, "/api/login", { email: "herder@yak.test", password, [field]: value });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      errors: [{ error_type: "invalid_request", error_code: code, detail, param: field }],
    });
    expect(await db.$count(sessions)).toBe(0);
  });

  test("a session is no longer recognised 14 days after login", async ({ app, db }) => {
    vi.setSystemTime(now);
    const user = await createUser(db);
    const response = await post(app, "/api/login", { email: "herder@yak.test", password });
    const token = sessionCookieToken(response) as string;

    expect(await sessionService.findUserBySessionToken(db, token, new Date(sessionExpiresAt.getTime() - 1))).toEqual(
      user,
    );
    expect(await sessionService.findUserBySessionToken(db, token, sessionExpiresAt)).toBeNull();
  });
});
