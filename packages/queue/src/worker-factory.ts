import type { ConnectionOptions, Job } from 'bullmq';
import { Worker } from 'bullmq';
import { EVENTS_QUEUE, type EventBatchJob } from './queues.js';

export type EventWorkerOptions = {
  concurrency: number;
  process: (job: Job<EventBatchJob>) => Promise<void>;
};

export function createEventsWorker(
  connection: ConnectionOptions,
  { concurrency, process }: EventWorkerOptions,
): Worker<EventBatchJob> {
  return new Worker<EventBatchJob>(EVENTS_QUEUE, process, {
    connection,
    concurrency,
  });
}
