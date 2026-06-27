import { existsSync } from 'node:fs';
import { z } from 'zod';

const ROOT_ENV = '../../.env';

const ConfigSchema = z
  .object({
    DATABASE_URL: z.string().min(1, 'DATABASE_URL is required.'),
    REDIS_URL: z.string().min(1).optional(),
    PORT: z.coerce.number().int().positive().default(3000),
    WORKER_CONCURRENCY: z.coerce.number().int().positive().default(1),
    RUN_WORKER_INLINE: z
      .string()
      .optional()
      .transform((v) => v === 'true' || v === '1'),
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
  databaseUrl: string;
  redisUrl: string | undefined;
  port: number;
  workerConcurrency: number;
  runWorkerInline: boolean;
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
  };
}
