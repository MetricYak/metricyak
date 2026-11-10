import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt } from "drizzle-orm";
import type { Database } from "@/db/index.js";
import { type SessionRecord, sessions } from "@/db/schema/sessions.js";
import { type UserRecord, users } from "@/db/schema/users.js";

export const SESSION_TTL_MS = 14 * 24 * 60 * 60 * 1000;

export type CreatedSession = {
  token: string;
  session: SessionRecord;
};

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export class SessionService {
  private readonly ttlMs: number;

  constructor(ttlMs: number) {
    this.ttlMs = ttlMs;
  }

  async createSession(db: Database, userId: string, now: Date): Promise<CreatedSession> {
    const token = randomBytes(32).toString("base64url");
    const [session] = await db
      .insert(sessions)
      .values({
        userId,
        tokenHash: hashToken(token),
        expiresAt: new Date(now.getTime() + this.ttlMs),
        createdAt: now,
      })
      .returning();
    if (!session) {
      throw new Error("Insert returned no session");
    }
    return { token, session };
  }

  async findUserBySessionToken(db: Database, token: string, now: Date): Promise<UserRecord | null> {
    const [row] = await db
      .select({ user: users })
      .from(sessions)
      .innerJoin(users, eq(users.id, sessions.userId))
      .where(and(eq(sessions.tokenHash, hashToken(token)), gt(sessions.expiresAt, now)));
    return row?.user ?? null;
  }

  async deleteSession(db: Database, token: string): Promise<void> {
    await db.delete(sessions).where(eq(sessions.tokenHash, hashToken(token)));
  }
}

export function createSessionService(): SessionService {
  return new SessionService(SESSION_TTL_MS);
}
