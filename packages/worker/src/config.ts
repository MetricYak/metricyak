import { WorkerConfig } from './types.js';

/**
 * Default worker configuration
 * Can be overridden via environment variables
 */
export const getWorkerConfig = (): WorkerConfig => {
  return {
    queueName: process.env.QUEUE_NAME || 'metricyak-jobs',
    redis: {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
      password: process.env.REDIS_PASSWORD,
      db: parseInt(process.env.REDIS_DB || '0', 10),
    },
    concurrency: parseInt(process.env.WORKER_CONCURRENCY || '10', 10),
    rateLimiter: {
      max: parseInt(process.env.RATE_LIMIT_MAX || '100', 10),
      duration: parseInt(process.env.RATE_LIMIT_DURATION || '60000', 10),
    },
  };
};
