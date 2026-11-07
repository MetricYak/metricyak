import { TransactionRollbackError } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import type { Hono } from "hono";
import { Pool } from "pg";
import { test as baseTest, inject } from "vitest";
import { createApp } from "@/api/app.js";
import type { AppEnv } from "@/api/env.js";
import { loadConfig } from "@/config/index.js";
import type { Database } from "@/db/index.js";
import { createEmailService } from "@/email/email-service.js";
import { logger } from "@/logger/index.js";

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
    const config = loadConfig({ NODE_ENV: "test", DATABASE_URL: inject("databaseUrl") });
    await use(createApp(config, db, createEmailService(config.email, logger)));
  },
});

export async function post(app: Hono<AppEnv>, path: string, body: unknown): Promise<Response> {
  return app.request(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}
