import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getWorkerConfig } from '../config.js';

describe('getWorkerConfig', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should return default configuration when no env vars are set', () => {
    delete process.env.QUEUE_NAME;
    delete process.env.REDIS_HOST;
    delete process.env.REDIS_PORT;

    const config = getWorkerConfig();

    expect(config).toEqual({
      queueName: 'metricyak-jobs',
      redis: {
        host: 'localhost',
        port: 6379,
        password: undefined,
        db: 0,
      },
      concurrency: 10,
      rateLimiter: {
        max: 100,
        duration: 60000,
      },
    });
  });

  it('should use environment variables when provided', () => {
    process.env.QUEUE_NAME = 'custom-queue';
    process.env.REDIS_HOST = 'redis.example.com';
    process.env.REDIS_PORT = '6380';
    process.env.REDIS_PASSWORD = 'secret';
    process.env.REDIS_DB = '1';
    process.env.WORKER_CONCURRENCY = '20';
    process.env.RATE_LIMIT_MAX = '200';
    process.env.RATE_LIMIT_DURATION = '30000';

    const config = getWorkerConfig();

    expect(config).toEqual({
      queueName: 'custom-queue',
      redis: {
        host: 'redis.example.com',
        port: 6380,
        password: 'secret',
        db: 1,
      },
      concurrency: 20,
      rateLimiter: {
        max: 200,
        duration: 30000,
      },
    });
  });

  it('should parse numeric environment variables correctly', () => {
    process.env.REDIS_PORT = '9999';
    process.env.WORKER_CONCURRENCY = '5';

    const config = getWorkerConfig();

    expect(config.redis.port).toBe(9999);
    expect(config.concurrency).toBe(5);
  });
});
