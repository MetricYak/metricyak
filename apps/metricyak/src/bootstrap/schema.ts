import { sql } from 'drizzle-orm';

const UNDEFINED_TABLE = '42P01';
const MAX_CAUSE_DEPTH = 10;

type SchemaProbe = { execute: (query: ReturnType<typeof sql>) => Promise<unknown> };

function hasPgCode(error: unknown, code: string, depth = 0): boolean {
  if (depth > MAX_CAUSE_DEPTH || typeof error !== 'object' || error === null) return false;
  if ('code' in error && (error as { code?: unknown }).code === code) return true;
  return 'cause' in error
    ? hasPgCode((error as { cause?: unknown }).cause, code, depth + 1)
    : false;
}

export async function assertSchemaReady(db: SchemaProbe): Promise<void> {
  try {
    await db.execute(sql`select 1 from "organizations" limit 1`);
  } catch (error) {
    if (hasPgCode(error, UNDEFINED_TABLE)) {
      throw new Error(
        'Database schema is missing. Run migrations first: `pnpm --filter @metricyak/storage db:migrate`.',
      );
    }
    throw error;
  }
}
