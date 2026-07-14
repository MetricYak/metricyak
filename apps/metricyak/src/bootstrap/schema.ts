import { PG_CODES, pgErrorCode } from '@metricyak/storage';
import { sql } from 'drizzle-orm';

type SchemaProbe = { execute: (query: ReturnType<typeof sql>) => Promise<unknown> };

export async function assertSchemaReady(db: SchemaProbe): Promise<void> {
  try {
    await db.execute(sql`select 1 from "organizations" limit 1`);
  } catch (error) {
    if (pgErrorCode(error) === PG_CODES.undefinedTable) {
      throw new Error(
        'Database schema is missing. Run migrations first: `pnpm --filter @metricyak/storage db:migrate`.',
      );
    }
    throw error;
  }
}
