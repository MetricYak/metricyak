import { existsSync } from 'node:fs';
import { z } from 'zod';

const ROOT_ENV = '../../.env';

const ConfigSchema = z.object({
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required.'),
  REDIS_URL: z.string().min(1, 'REDIS_URL is required.'),
  PORT: z.coerce.number().int().positive().default(3000),
  WORKER_CONCURRENCY: z.coerce.number().int().positive().default(1),
  RUN_WORKER_INLINE: z
    .string()
    .optional()
    .transform((v) => v === 'true' || v === '1'),
  RUN_WORKERS_IN_API: z
    .string()
    .optional()
    .transform((v) => v !== 'false' && v !== '0'),
  LIVESTREAM_PORT: z.coerce.number().int().positive().default(3002),
  LIVESTREAM_CORS_ALLOW_ORIGINS: z
    .string()
    .optional()
    .transform((v) => (v ? v.split(',').map((o) => o.trim()) : ['http://localhost:3001'])),
  // TODO(JWT): remove once dashboard user auth lands; this is a placeholder seam so the
  // livestream client already sends an Authorization header the future PR can start verifying.
  LIVESTREAM_DEV_TOKEN: z.string().optional(),
});

export type Config = {
  readonly databaseUrl: string;
  readonly redisUrl: string;
  readonly port: number;
  readonly workerConcurrency: number;
  readonly runWorkerInline: boolean;
  readonly runWorkersInApi: boolean;
  readonly livestreamPort: number;
  readonly livestreamCorsAllowOrigins: string[];
  readonly livestreamDevToken: string | undefined;
};

export function loadConfig(): Config {
  if (existsSync(ROOT_ENV)) {
    process.loadEnvFile(ROOT_ENV);
  }

  const env = ConfigSchema.parse(process.env);

  return {
    databaseUrl: env.DATABASE_URL,
    redisUrl: env.REDIS_URL,
    port: env.PORT,
    workerConcurrency: env.WORKER_CONCURRENCY,
    runWorkerInline: env.RUN_WORKER_INLINE,
    runWorkersInApi: env.RUN_WORKERS_IN_API,
    livestreamPort: env.LIVESTREAM_PORT,
    livestreamCorsAllowOrigins: env.LIVESTREAM_CORS_ALLOW_ORIGINS,
    livestreamDevToken: env.LIVESTREAM_DEV_TOKEN,
  };
}
