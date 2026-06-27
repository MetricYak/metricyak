import { createEventsWorker, EVENTS_QUEUE } from '@metricyak/queue';
import type { AppModule, WorkerFactory } from '../module.js';
import eventsRouter from './events.routes.js';
import { processEventBatch } from './events.worker.js';

const eventsWorkerFactory: WorkerFactory = (connection, container, concurrency) => {
  const worker = createEventsWorker(connection, {
    concurrency,
    process: (job) => processEventBatch(job.data, container.events),
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
