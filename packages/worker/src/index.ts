import { Job } from 'bullmq';
import { MetricYakWorker } from './worker.js';
import { getWorkerConfig } from './config.js';

/**
 * Simple job processor function
 * Replace this with your actual job processing logic
 */
async function processJob(job: Job): Promise<unknown> {
  console.log(`Processing job ${job.id} with data:`, job.data);

  // Your job processing logic goes here

  return { success: true };
}

/**
 * Main entry point
 */
async function main() {
  const config = getWorkerConfig();

  console.log('[MetricYak Worker] Starting worker...');
  console.log('[MetricYak Worker] Configuration:', {
    queueName: config.queueName,
    redis: `${config.redis.host}:${config.redis.port}`,
    concurrency: config.concurrency,
  });

  const worker = new MetricYakWorker(config, processJob);

  // Graceful shutdown with error handling and re-entry protection
  let isShuttingDown = false;

  const shutdownHandler = async (signal: 'SIGTERM' | 'SIGINT') => {
    if (isShuttingDown) {
      console.log(`[MetricYak Worker] Already shutting down, ignoring ${signal}`);
      return;
    }

    isShuttingDown = true;
    console.log(`[MetricYak Worker] Received ${signal}, shutting down...`);

    try {
      await worker.close();
      console.log('[MetricYak Worker] Worker closed successfully');
      process.exitCode = 0;
    } catch (error) {
      console.error('[MetricYak Worker] Error during shutdown:', error);
      process.exitCode = 1;
    }
  };

  process.once('SIGTERM', () => shutdownHandler('SIGTERM'));
  process.once('SIGINT', () => shutdownHandler('SIGINT'));

  console.log('[MetricYak Worker] Worker is ready and listening for jobs');
}

main().catch((error) => {
  console.error('[MetricYak Worker] Fatal error:', error);
  process.exit(1);
});

export { MetricYakWorker } from './worker.js';
export { getWorkerConfig } from './config.js';
export type { WorkerConfig, MetricJobData, JobResult } from './types.js';
