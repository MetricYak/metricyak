import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Job, Worker } from 'bullmq';
import { MetricYakWorker } from '../worker.js';
import { WorkerConfig } from '../types.js';

// Mock BullMQ Worker to avoid requiring a live Redis connection
vi.mock('bullmq', async () => {
  const actual = await vi.importActual('bullmq');
  return {
    ...actual,
    Worker: vi.fn().mockImplementation(() => ({
      on: vi.fn().mockReturnThis(),
      close: vi.fn().mockResolvedValue(undefined),
    })),
  };
});

describe('MetricYakWorker', () => {
  let worker: MetricYakWorker;
  const mockProcessor = vi.fn(async (job: Job) => {
    return { processed: true, jobId: job.id };
  });

  const testConfig: WorkerConfig = {
    queueName: 'test-queue',
    redis: {
      host: 'localhost',
      port: 6379,
    },
    concurrency: 5,
    rateLimiter: {
      max: 10,
      duration: 1000,
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(async () => {
    if (worker) {
      await worker.close();
    }
  });

  it('should create a worker instance', () => {
    worker = new MetricYakWorker(testConfig, mockProcessor);
    expect(worker).toBeDefined();
    expect(Worker).toHaveBeenCalledWith(
      testConfig.queueName,
      mockProcessor,
      expect.objectContaining({
        connection: expect.objectContaining({
          host: testConfig.redis.host,
          port: testConfig.redis.port,
        }),
        concurrency: testConfig.concurrency,
        limiter: testConfig.rateLimiter,
      })
    );
  });

  it('should accept a custom processor function', () => {
    const customProcessor = vi.fn(async (job: Job) => {
      return { custom: true, data: job.data };
    });

    worker = new MetricYakWorker(testConfig, customProcessor);
    expect(worker).toBeDefined();
    expect(Worker).toHaveBeenCalledWith(
      testConfig.queueName,
      customProcessor,
      expect.any(Object)
    );
  });

  it('should close gracefully', async () => {
    worker = new MetricYakWorker(testConfig, mockProcessor);
    await expect(worker.close()).resolves.not.toThrow();
  });
});
