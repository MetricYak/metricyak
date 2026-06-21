import { existsSync } from 'node:fs';
import { z } from 'zod';

const ROOT_ENV = '../../.env';

const ConfigSchema = z.object({
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required.'),
  PORT: z.coerce.number().int().positive().default(3000),
});

export type Config = {
  databaseUrl: string;
  port: number;
};

export function loadConfig(): Config {
  if (existsSync(ROOT_ENV)) {
    process.loadEnvFile(ROOT_ENV);
  }

  const env = ConfigSchema.parse(process.env);

  return {
    databaseUrl: env.DATABASE_URL,
    port: env.PORT,
  };
}
