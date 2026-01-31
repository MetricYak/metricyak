import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Job } from 'bullmq';
import { MetricYakWorker } from '../worker.js';
import { WorkerConfig } from '../types.js';

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
  });

  it('should accept a custom processor function', () => {
    const customProcessor = vi.fn(async (job: Job) => {
      return { custom: true, data: job.data };
    });

    worker = new MetricYakWorker(testConfig, customProcessor);
    expect(worker).toBeDefined();
  });

  it('should close gracefully', async () => {
    worker = new MetricYakWorker(testConfig, mockProcessor);
    await expect(worker.close()).resolves.not.toThrow();
  });
});
