import { existsSync } from 'node:fs';
import { defineConfig } from 'drizzle-kit';

const ROOT_ENV = '../../.env';
if (existsSync(ROOT_ENV)) {
  process.loadEnvFile(ROOT_ENV);
}

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error('DATABASE_URL is not set. Add it to the repo-root .env file.');
}

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/schema',
  out: './migrations',
  casing: 'snake_case',
  dbCredentials: {
    url: databaseUrl,
  },
  verbose: true,
  strict: true,
});
