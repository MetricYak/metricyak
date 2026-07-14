import type { ConnectionOptions, Job } from 'bullmq';
import { Queue, Worker } from 'bullmq';
import {
  EVENTS_QUEUE,
  type EventBatchJob,
  MONITOR_SIGNALS_QUEUE,
  MONITOR_TICK_INTERVAL_MS,
  MONITOR_TICK_QUEUE,
  type MonitorSignalJob,
  type MonitorTickJob,
} from './queues.js';

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

export type MonitorTickWorkerOptions = {
  concurrency: number;
  process: (job: Job<MonitorTickJob>) => Promise<void>;
};

export function createMonitorTickWorker(
  connection: ConnectionOptions,
  { concurrency, process }: MonitorTickWorkerOptions,
): Worker<MonitorTickJob> {
  return new Worker<MonitorTickJob>(MONITOR_TICK_QUEUE, process, { connection, concurrency });
}

export async function registerMonitorTickScheduler(connection: ConnectionOptions): Promise<void> {
  const queue = new Queue<MonitorTickJob>(MONITOR_TICK_QUEUE, { connection });
  try {
    await queue.upsertJobScheduler(
      'monitor-tick',
      { every: MONITOR_TICK_INTERVAL_MS },
      {
        name: MONITOR_TICK_QUEUE,
        data: { tickAt: 'scheduled' },
        opts: { removeOnComplete: { age: 3600, count: 100 }, removeOnFail: { age: 7 * 24 * 3600 } },
      },
    );
  } finally {
    await queue.close();
  }
}

export type MonitorSignalsWorkerOptions = {
  concurrency: number;
  process: (job: Job<MonitorSignalJob>) => Promise<void>;
};

export function createMonitorSignalsWorker(
  connection: ConnectionOptions,
  { concurrency, process }: MonitorSignalsWorkerOptions,
): Worker<MonitorSignalJob> {
  return new Worker<MonitorSignalJob>(MONITOR_SIGNALS_QUEUE, process, { connection, concurrency });
}
