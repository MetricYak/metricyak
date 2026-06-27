import { createEventsWorker, createWorkerConnectionOptions, EVENTS_QUEUE } from '@metricyak/queue';
import { createDatabase, EventsRepository, FailedEventsRepository } from '@metricyak/storage';
import type { Config } from '../config.js';
import { processEventBatch } from './process-events.js';

export async function startWorker(config: Config): Promise<void> {
  if (!config.redisUrl) {
    throw new Error('REDIS_URL is required to run the worker.');
  }

  const db = createDatabase(config.databaseUrl);
  const connection = createWorkerConnectionOptions(config.redisUrl);

  const eventsRepo = new EventsRepository(db);
  const failedEventsRepo = new FailedEventsRepository(db);

  const worker = createEventsWorker(connection, {
    concurrency: config.workerConcurrency,
    process: (job) => processEventBatch(job.data, eventsRepo),
  });

  worker.on('completed', (job) => {
    console.log(
      JSON.stringify({
        level: 'info',
        msg: 'job completed',
        jobId: job.id,
        events: (job.data.events ?? []).length,
        projectId: job.data.projectId,
      }),
    );
  });

  worker.on('failed', async (job, err) => {
    const maxAttempts = job?.opts?.attempts ?? 1;
    const exhausted = (job?.attemptsMade ?? 0) >= maxAttempts;

    console.log(
      JSON.stringify({
        level: 'error',
        msg: exhausted ? 'job failed (exhausted)' : 'job failed (will retry)',
        jobId: job?.id,
        attemptsMade: job?.attemptsMade,
        maxAttempts,
        error: err.message,
      }),
    );

    if (exhausted && job) {
      try {
        await failedEventsRepo.record({
          queue: EVENTS_QUEUE,
          jobId: job.id ?? null,
          payload: job.data,
          error: err.message,
          attemptsMade: job.attemptsMade,
        });
      } catch (recordErr) {
        console.log(
          JSON.stringify({
            level: 'error',
            msg: 'failed to record dead-letter event',
            jobId: job.id,
            error: (recordErr as Error).message,
          }),
        );
      }
    }
  });

  const shutdown = async (signal: string) => {
    console.log(JSON.stringify({ level: 'info', msg: `${signal} received, shutting down worker` }));
    await worker.close();
    process.exit(0);
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));

  console.log(
    JSON.stringify({
      level: 'info',
      msg: 'worker started',
      queue: EVENTS_QUEUE,
      concurrency: config.workerConcurrency,
    }),
  );
}
