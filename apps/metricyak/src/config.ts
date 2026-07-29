import { existsSync } from 'node:fs';
import { MASTER_KEY_BYTES, type MasterKey, parseMasterKey } from '@metricyak/secrets';
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

function brokerList(envVarName: string) {
  return z
    .string()
    .min(1, `${envVarName} is required.`)
    .transform((s) =>
      s
        .split(',')
        .map((x) => x.trim())
        .filter(Boolean),
    )
    .refine((brokers) => brokers.length > 0, {
      message: `${envVarName} must list at least one broker.`,
    });
}

function masterKey(envVarName: string) {
  const generateHint = `Generate one with \`pnpm secrets:genkey\`.`;
  return z
    .string({ error: `${envVarName} is required. ${generateHint}` })
    .min(1, `${envVarName} is required. ${generateHint}`)
    .transform((value, ctx) => {
      const parsed = parseMasterKey(value);
      switch (parsed.kind) {
        case 'ok':
          return parsed.key;
        case 'not_base64':
          ctx.addIssue({
            code: 'custom',
            message: `${envVarName} must be base64-encoded. ${generateHint}`,
          });
          return z.NEVER;
        case 'wrong_length':
          ctx.addIssue({
            code: 'custom',
            message: `${envVarName} must decode to ${MASTER_KEY_BYTES} bytes, got ${parsed.byteLength}. ${generateHint}`,
          });
          return z.NEVER;
        default: {
          const _exhaustive: never = parsed;
          throw new Error(`Unhandled master key result: ${JSON.stringify(_exhaustive)}`);
        }
      }
    });
}

const ConfigSchema = z
  .object({
    DATABASE_URL: z.string().min(1, 'DATABASE_URL is required.').refine(isPostgresUrlWithPassword, {
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
    KAFKA_BROKERS: brokerList('KAFKA_BROKERS'),
    // No fallback to KAFKA_BROKERS: that address is host-reachable, not reachable from inside
    // ClickHouse's own container, so silently reusing it would recreate the exact bug this
    // variable exists to fix (ClickHouse's Kafka Engine table would connect to nothing) —
    // without ever surfacing an error, since the Kafka Engine connects lazily.
    CLICKHOUSE_KAFKA_BROKERS: brokerList('CLICKHOUSE_KAFKA_BROKERS'),
    CLICKHOUSE_URL: z
      .string()
      .url('CLICKHOUSE_URL must be a valid URL.')
      .min(1, 'CLICKHOUSE_URL is required.'),
    // No fallback and no dev default: this codebase is public, so any key committed here would
    // be a published key. A deployment that forgets to set it must fail to boot rather than
    // encrypt real customer credentials under a value anyone can read.
    SECRETS_MASTER_KEY: masterKey('SECRETS_MASTER_KEY'),
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
  readonly kafkaBrokers: string[];
  readonly clickhouseKafkaBrokers: string[];
  readonly clickhouseUrl: string;
  readonly secretsMasterKey: MasterKey;
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
    kafkaBrokers: parsed.KAFKA_BROKERS,
    clickhouseKafkaBrokers: parsed.CLICKHOUSE_KAFKA_BROKERS,
    clickhouseUrl: parsed.CLICKHOUSE_URL,
    secretsMasterKey: parsed.SECRETS_MASTER_KEY,
  };
}

export function loadConfig(): Config {
  if (existsSync(ROOT_ENV)) {
    process.loadEnvFile(ROOT_ENV);
  }
  return parseConfig(process.env);
}
