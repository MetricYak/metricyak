import { existsSync } from 'node:fs';
import { z } from 'zod';

const ROOT_ENV = '../../.env';

function isPostgresUrlWithPassword(value: string): boolean {
  try {
    const url = new URL(value);
    if (url.protocol !== 'postgres:' && url.protocol !== 'postgresql:') return false;
    return url.password.length > 0;
  } catch {
    return false;
  }
}

const ConfigSchema = z
  .object({
    DATABASE_URL: z
      .string()
      .min(1, 'DATABASE_URL is required.')
      .refine(isPostgresUrlWithPassword, {
        message:
          'DATABASE_URL must be a postgres://user:password@host:port/db URL (with a password).',
      }),
    REDIS_URL: z.string().min(1).optional(),
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
  })
  .superRefine((data, ctx) => {
    if (!data.RUN_WORKER_INLINE && !data.REDIS_URL) {
      ctx.addIssue({
        code: 'custom',
        path: ['REDIS_URL'],
        message: 'REDIS_URL is required when RUN_WORKER_INLINE is not set.',
      });
    }
  });

export type Config = {
  readonly databaseUrl: string;
  readonly redisUrl: string | undefined;
  readonly port: number;
  readonly workerConcurrency: number;
  readonly runWorkerInline: boolean;
  readonly runWorkersInApi: boolean;
};

export function parseConfig(env: NodeJS.ProcessEnv): Config {
  const parsed = ConfigSchema.parse(env);
  return {
    databaseUrl: parsed.DATABASE_URL,
    redisUrl: parsed.REDIS_URL,
    port: parsed.PORT,
    workerConcurrency: parsed.WORKER_CONCURRENCY,
    runWorkerInline: parsed.RUN_WORKER_INLINE,
    runWorkersInApi: parsed.RUN_WORKERS_IN_API,
  };
}

export function loadConfig(): Config {
  if (existsSync(ROOT_ENV)) {
    process.loadEnvFile(ROOT_ENV);
  }
  return parseConfig(process.env);
}
