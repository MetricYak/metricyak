import { Worker, Job } from 'bullmq';
import { WorkerConfig } from './types.js';

/**
 * MetricYak Worker
 * Listens to BullMQ jobs and processes them
 */
export class MetricYakWorker {
  private worker: Worker;

  constructor(
    config: WorkerConfig,
    processor: (job: Job) => Promise<unknown>
  ) {
    this.worker = new Worker(
      config.queueName,
      processor,
      {
        connection: {
          host: config.redis.host,
          port: config.redis.port,
          password: config.redis.password,
          db: config.redis.db,
        },
        concurrency: config.concurrency,
        limiter: config.rateLimiter,
      }
    );

    this.setupEventListeners();
  }

  /**
   * Set up event listeners for worker lifecycle events
   */
  private setupEventListeners(): void {
    this.worker.on('completed', (job, result) => {
      console.log(`[Worker] Job ${job.id} completed with result:`, result);
    });

    this.worker.on('failed', (job, error) => {
      console.error(`[Worker] Job ${job?.id} failed:`, error.message);
    });

    this.worker.on('progress', (job, progress) => {
      console.log(`[Worker] Job ${job.id} progress: ${progress}%`);
    });

    this.worker.on('error', (error) => {
      console.error('[Worker] Error:', error);
    });

    this.worker.on('drained', () => {
      console.log('[Worker] Queue is empty, waiting for new jobs...');
    });
  }

  /**
   * Gracefully close the worker
   */
  async close(): Promise<void> {
    await this.worker.close();
  }
}
