import { WorkerConfig } from './types.js';

/**
 * Safely parse an integer from a string, returning a default value if parsing fails
 * @param value - The string value to parse
 * @param defaultValue - The default value to return if parsing fails
 * @returns The parsed integer or the default value
 */
function safeParseInt(value: string | undefined, defaultValue: number): number {
  if (!value) {
    return defaultValue;
  }
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
}

/**
 * Default worker configuration
 * Can be overridden via environment variables
 */
export const getWorkerConfig = (): WorkerConfig => {
  return {
    queueName: process.env.QUEUE_NAME || 'metricyak-jobs',
    redis: {
      host: process.env.REDIS_HOST || 'localhost',
      port: safeParseInt(process.env.REDIS_PORT, 6379),
      password: process.env.REDIS_PASSWORD,
      db: safeParseInt(process.env.REDIS_DB, 0),
    },
    concurrency: safeParseInt(process.env.WORKER_CONCURRENCY, 10),
    rateLimiter: {
      max: safeParseInt(process.env.RATE_LIMIT_MAX, 100),
      duration: safeParseInt(process.env.RATE_LIMIT_DURATION, 60000),
    },
  };
};
