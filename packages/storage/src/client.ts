import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from '@/schema/index.js';

export type Schema = typeof schema;
export type Database = NodePgDatabase<Schema>;

type TransactionExecutor = Parameters<Parameters<Database['transaction']>[0]>[0];
export type Executor = Database | TransactionExecutor;

export function createDatabase(connectionString: string): Database {
  const pool = new Pool({ connectionString });

  return drizzle({ client: pool, schema, casing: 'snake_case' });
}
