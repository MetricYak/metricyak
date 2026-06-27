import { existsSync } from 'node:fs';
import { z } from 'zod';

const ROOT_ENV = '../../.env';

const ConfigSchema = z
  .object({
    DATABASE_URL: z.string().min(1, 'DATABASE_URL is required.'),
    REDIS_URL: z.string().min(1).optional(),
    PORT: z.coerce.number().int().positive().default(3000),
    WORKER_CONCURRENCY: z.coerce.number().int().positive().default(1),
    // Local-dev only: skip Redis entirely; the event handler is called in-process.
    RUN_WORKER_INLINE: z
      .string()
      .optional()
      .transform((v) => v === 'true' || v === '1'),
    // Self-host single-deploy: when true (default), index.ts boots workers in the
    // same process as HTTP. Set to false for the scale-out API-only tier so workers
    // run separately via worker.ts.
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
  };
}
