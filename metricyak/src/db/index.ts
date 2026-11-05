import { drizzle, type NodePgQueryResultHKT } from "drizzle-orm/node-postgres";
import type { PgAsyncDatabase } from "drizzle-orm/pg-core";
import { Pool } from "pg";

export type Database = PgAsyncDatabase<NodePgQueryResultHKT>;

export function createDatabase(url: string): { db: Database; pool: Pool } {
  const pool = new Pool({ connectionString: url });
  return { db: drizzle({ client: pool }), pool };
}
