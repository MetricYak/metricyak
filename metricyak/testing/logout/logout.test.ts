import { eq } from "drizzle-orm";
import type { Hono } from "hono";
import { describe, expect } from "vitest";
import type { AppEnv } from "@/api/env.js";
import type { CreatedSession } from "@/auth/session-service.js";
import type { Database } from "@/db/index.js";
import { type SessionRecord, sessions } from "@/db/schema/sessions.js";
import { type UserRecord, users } from "@/db/schema/users.js";
import { sessionService, test } from "../fixtures.js";

const now = new Date("2026-01-01T00:00:00.000Z");
const lastYear = new Date("2025-01-01T00:00:00.000Z");

async function findSession(db: Database, session: SessionRecord): Promise<SessionRecord | null> {
  const [row] = await db.select().from(sessions).where(eq(sessions.id, session.id));
  return row ?? null;
}

async function givenAUser(db: Database): Promise<UserRecord> {
  const [user] = await db
    .insert(users)
    .values({
      firstName: "Yak",
      lastName: "Herder",
      email: "herder@yak.test",
      passwordHash: null,
      emailVerifiedAt: now,
      createdAt: now,
      updatedAt: now,
    })
    .returning();
  if (!user) {
    throw new Error("Insert returned no user");
  }
  return user;
}

async function givenASessionExistsForUser(db: Database, user: UserRecord, at: Date = now): Promise<CreatedSession> {
  return sessionService.createSession(db, user.id, at);
}

async function whenTheyLogOut(app: Hono<AppEnv>, token?: string): Promise<Response> {
  return app.request("/api/logout", {
    method: "POST",
    headers: token === undefined ? {} : { cookie: `metricyak_session=${token}` },
  });
}

async function thenTheyAreLoggedOut(response: Response): Promise<void> {
  expect(response.status).toBe(204);
  expect(await response.text()).toBe("");
  expect(response.headers.get("set-cookie")).toBe(
    "metricyak_session=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Lax",
  );
}

async function thenTheSessionIsRemoved(db: Database, { session, token }: CreatedSession): Promise<void> {
  expect(await findSession(db, session)).toBeNull();
  expect(await sessionService.findUserBySessionToken(db, token, now)).toBeNull();
}

async function thenTheSessionIsStillActive(db: Database, { session, token }: CreatedSession): Promise<void> {
  expect(await findSession(db, session)).toEqual(session);
  expect((await sessionService.findUserBySessionToken(db, token, now))?.id).toBe(session.userId);
}

describe("POST /api/logout", () => {
  test("a logged-in user logs out and their old session cookie is no longer recognised", async ({ app, db }) => {
    const user = await givenAUser(db);
    const session = await givenASessionExistsForUser(db, user);

    const response = await whenTheyLogOut(app, session.token);

    await thenTheyAreLoggedOut(response);
    await thenTheSessionIsRemoved(db, session);
  });

  test("a user logs out on one device and stays logged in on their other devices", async ({ app, db }) => {
    const user = await givenAUser(db);
    const firstSession = await givenASessionExistsForUser(db, user);
    const secondSession = await givenASessionExistsForUser(db, user);

    const response = await whenTheyLogOut(app, firstSession.token);

    await thenTheyAreLoggedOut(response);
    await thenTheSessionIsRemoved(db, firstSession);
    await thenTheSessionIsStillActive(db, secondSession);
  });

  test("a visitor logs out with no session cookie and other sessions are left alone", async ({ app, db }) => {
    const user = await givenAUser(db);
    const session = await givenASessionExistsForUser(db, user);

    const response = await whenTheyLogOut(app);

    await thenTheyAreLoggedOut(response);
    await thenTheSessionIsStillActive(db, session);
  });

  test("a visitor logs out with an unknown session cookie and other sessions are left alone", async ({ app, db }) => {
    const user = await givenAUser(db);
    const session = await givenASessionExistsForUser(db, user);

    const response = await whenTheyLogOut(app, "unknown-yak-token");

    await thenTheyAreLoggedOut(response);
    await thenTheSessionIsStillActive(db, session);
  });

  test("a user logs out with an expired session cookie and the expired session is removed", async ({ app, db }) => {
    const user = await givenAUser(db);
    const expiredSession = await givenASessionExistsForUser(db, user, lastYear);

    const response = await whenTheyLogOut(app, expiredSession.token);

    await thenTheyAreLoggedOut(response);
    await thenTheSessionIsRemoved(db, expiredSession);
  });
});
