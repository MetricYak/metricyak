import { existsSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { createDatabase, type Database } from '@/client.js';
import { hashKey } from '@/lib/keys.js';
import { organizations, projectKeys, projects } from '@/schema/index.js';

const ROOT_ENV = '../../.env';

export const DEV_ORG_ID = '00000000-0000-4000-8000-0000000000a1';
export const DEV_PROJECT_ID = '00000000-0000-4000-8000-0000000000b1';
export const DEV_PROJECT_KEY_ID = '00000000-0000-4000-8000-0000000000c1';
export const DEV_PROJECT_KEY = 'myk_pub_dev_00000000000000000000000000000000';

export async function seed(db: Database): Promise<void> {
  await db
    .insert(organizations)
    .values({ id: DEV_ORG_ID, slug: 'default', name: 'MetricYak (Dev)' })
    .onConflictDoNothing();

  await db
    .insert(projects)
    .values({ id: DEV_PROJECT_ID, organizationId: DEV_ORG_ID, name: 'Default' })
    .onConflictDoNothing();

  await db
    .insert(projectKeys)
    .values({
      id: DEV_PROJECT_KEY_ID,
      projectId: DEV_PROJECT_ID,
      name: 'Dev Key',
      key: hashKey(DEV_PROJECT_KEY),
    })
    .onConflictDoNothing();
}

async function main(): Promise<void> {
  if (process.env.NODE_ENV === 'production' && process.env.SEED_FORCE !== '1') {
    throw new Error('Cannot seed in production. Set SEED_FORCE=1 to override.');
  }

  if (existsSync(ROOT_ENV)) {
    process.loadEnvFile(ROOT_ENV);
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is not set. Add it to the repo-root .env file.');
  }

  const db = createDatabase(databaseUrl);
  await seed(db);

  console.log(
    `Seeded org ${DEV_ORG_ID}, project ${DEV_PROJECT_ID}, and dev project key ${DEV_PROJECT_KEY}.`,
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
