import { TransactionRollbackError } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import type { Hono } from "hono";
import { Pool } from "pg";
import { test as baseTest, inject } from "vitest";
import { createApp } from "@/api/app.js";
import type { AppEnv } from "@/api/env.js";
import { createPasswordService } from "@/auth/password-service.js";
import { createSessionService } from "@/auth/session-service.js";
import { loadConfig } from "@/config/index.js";
import type { Database } from "@/db/index.js";
import { createEmailService } from "@/email/email-service.js";
import { logger } from "@/logger/index.js";

const passwordService = createPasswordService();
export const sessionService = createSessionService();

export function createTestApp(db: Database, env: NodeJS.ProcessEnv = {}): Hono<AppEnv> {
  const config = loadConfig({ NODE_ENV: "test", DATABASE_URL: inject("databaseUrl"), ...env });
  return createApp(config, db, createEmailService(config.email, logger), passwordService, sessionService);
}

export const test = baseTest.extend<{
  $file: { pool: Pool };
  $test: { db: Database; app: Hono<AppEnv> };
}>({
  pool: [
    // biome-ignore lint/correctness/noEmptyPattern: vitest requires fixtures to destructure their context
    async ({}, use) => {
      const pool = new Pool({ connectionString: inject("databaseUrl") });
      await use(pool);
      await pool.end();
    },
    { scope: "file" },
  ],
  db: async ({ pool }, use) => {
    await drizzle({ client: pool })
      .transaction(async (tx) => {
        await use(tx);
        tx.rollback();
      })
      .catch((err) => {
        if (!(err instanceof TransactionRollbackError)) {
          throw err;
        }
      });
  },
  app: async ({ db }, use) => {
    await use(createTestApp(db));
  },
});

export type RequestOptions = {
  token?: string;
  headers?: Record<string, string>;
};

export function requestHeaders({
  token,
  headers = { "sec-fetch-site": "same-origin" },
}: RequestOptions = {}): Record<string, string> {
  return token === undefined ? headers : { ...headers, cookie: `__Host-id=${token}` };
}

export async function post(
  app: Hono<AppEnv>,
  path: string,
  body: unknown,
  options: RequestOptions = {},
): Promise<Response> {
  return app.request(path, {
    method: "POST",
    headers: { "content-type": "application/json", ...requestHeaders(options) },
    body: JSON.stringify(body),
  });
}

export function sessionCookieToken(response: Response): string | null {
  const match = response.headers.get("set-cookie")?.match(/^__Host-id=([^;]+)/);
  return match?.[1] ?? null;
}
