import { createEventsWorker, EVENTS_QUEUE } from '@metricyak/queue';
import type { AppModule, WorkerFactory } from '../module.js';
import { createIngestPipeline } from './events.ingest.js';
import eventsRouter from './events.routes.js';

const eventsWorkerFactory: WorkerFactory = (connection, container, concurrency) => {
  const pipeline = createIngestPipeline({
    events: container.events,
    aggregates: container.aggregates,
    matcher: container.matcher,
    runInTransaction: (fn) => container.db.transaction(fn),
  });

  const worker = createEventsWorker(connection, {
    concurrency,
    process: (job) => pipeline.ingestBatch(job.data),
  });

  worker.on('completed', (job) => {
    console.log(
      JSON.stringify({
        level: 'info',
        msg: 'job completed',
        jobId: job.id,
        events: job.data.events.length,
        projectId: job.data.projectId,
      }),
    );
  });

  worker.on('failed', async (job, err) => {
    const maxAttempts = job?.opts?.attempts ?? 1;
    const exhausted = (job?.attemptsMade ?? 0) >= maxAttempts;

    if (exhausted && job) {
      try {
        await container.failedEvents.record({
          queue: EVENTS_QUEUE,
          jobId: job.id ?? null,
          payload: job.data,
          error: err.message,
          attemptsMade: job.attemptsMade,
        });
      } catch (recordErr) {
        const errorMessage = recordErr instanceof Error ? recordErr.message : String(recordErr);
        console.log(
          JSON.stringify({
            level: 'error',
            msg: 'failed to record dead-letter event',
            jobId: job.id,
            error: errorMessage,
          }),
        );
      }
    }
  });

  return worker;
};

export const eventsModule: AppModule = {
  routes: eventsRouter,
  workers: [eventsWorkerFactory],
};
