import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import type { TestProject } from "vitest/node";

declare module "vitest" {
  export interface ProvidedContext {
    databaseUrl: string;
  }
}

let container: StartedPostgreSqlContainer;

export async function setup(project: TestProject) {
  container = await new PostgreSqlContainer("postgres:18")
    .withUsername("metricyak")
    .withPassword("metricyak")
    .withDatabase("metricyak")
    .start();

  const databaseUrl = container.getConnectionUri();
  const db = drizzle(databaseUrl);
  await migrate(db, { migrationsFolder: "./migrations" });
  await db.$client.end();

  project.provide("databaseUrl", databaseUrl);
}

export async function teardown() {
  await container?.stop();
}
