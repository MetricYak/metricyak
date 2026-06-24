import { existsSync } from 'node:fs';
import type { QueueDriver } from '@metricyak/queue';
import { z } from 'zod';

const ROOT_ENV = '../../.env';

const ConfigSchema = z.object({
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required.'),
  PORT: z.coerce.number().int().positive().default(3000),
  QUEUE_DRIVER: z.enum(['postgres', 'memory']).default('postgres'),
});

export type Config = {
  databaseUrl: string;
  port: number;
  queueDriver: QueueDriver;
};

export function loadConfig(): Config {
  if (existsSync(ROOT_ENV)) {
    process.loadEnvFile(ROOT_ENV);
  }

  const env = ConfigSchema.parse(process.env);

  return {
    databaseUrl: env.DATABASE_URL,
    port: env.PORT,
    queueDriver: env.QUEUE_DRIVER,
  };
}
