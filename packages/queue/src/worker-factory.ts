import type { ConnectionOptions, Job } from 'bullmq';
import { Queue, Worker } from 'bullmq';
import {
  MONITOR_DISPATCH_INTERVAL_MS,
  MONITOR_DISPATCH_QUEUE,
  MONITOR_DRAIN_INTERVAL_MS,
  MONITOR_DRAIN_QUEUE,
  MONITOR_EVAL_QUEUE,
  MONITOR_RELAY_INTERVAL_MS,
  MONITOR_RELAY_QUEUE,
  MONITOR_SIGNALS_QUEUE,
  type MonitorDispatchJob,
  type MonitorDrainJob,
  type MonitorEvalJob,
  type MonitorRelayJob,
  type MonitorSignalJob,
} from '@/queues.js';

export type MonitorDispatchWorkerOptions = {
  concurrency: number;
  process: (job: Job<MonitorDispatchJob>) => Promise<void>;
};

export function createMonitorDispatchWorker(
  connection: ConnectionOptions,
  { concurrency, process }: MonitorDispatchWorkerOptions,
): Worker<MonitorDispatchJob> {
  return new Worker<MonitorDispatchJob>(MONITOR_DISPATCH_QUEUE, process, {
    connection,
    concurrency,
  });
}

export async function registerMonitorDispatchScheduler(
  connection: ConnectionOptions,
): Promise<void> {
  const queue = new Queue<MonitorDispatchJob>(MONITOR_DISPATCH_QUEUE, { connection });
  try {
    await queue.upsertJobScheduler(
      'monitor-dispatch',
      { every: MONITOR_DISPATCH_INTERVAL_MS },
      {
        name: MONITOR_DISPATCH_QUEUE,
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

export type MonitorEvalWorkerOptions = {
  concurrency: number;
  process: (job: Job<MonitorEvalJob>) => Promise<void>;
};

export function createMonitorEvalWorker(
  connection: ConnectionOptions,
  { concurrency, process }: MonitorEvalWorkerOptions,
): Worker<MonitorEvalJob> {
  return new Worker<MonitorEvalJob>(MONITOR_EVAL_QUEUE, process, { connection, concurrency });
}

export type MonitorRelayWorkerOptions = {
  concurrency: number;
  process: (job: Job<MonitorRelayJob>) => Promise<void>;
};

export function createMonitorRelayWorker(
  connection: ConnectionOptions,
  { concurrency, process }: MonitorRelayWorkerOptions,
): Worker<MonitorRelayJob> {
  return new Worker<MonitorRelayJob>(MONITOR_RELAY_QUEUE, process, { connection, concurrency });
}

export async function registerMonitorRelayScheduler(connection: ConnectionOptions): Promise<void> {
  const queue = new Queue<MonitorRelayJob>(MONITOR_RELAY_QUEUE, { connection });
  try {
    await queue.upsertJobScheduler(
      'monitor-relay',
      { every: MONITOR_RELAY_INTERVAL_MS },
      {
        name: MONITOR_RELAY_QUEUE,
        data: { tickAt: 'scheduled' },
        opts: { removeOnComplete: { age: 3600, count: 100 }, removeOnFail: { age: 7 * 24 * 3600 } },
      },
    );
  } finally {
    await queue.close();
  }
}

export type MonitorDrainWorkerOptions = {
  concurrency: number;
  process: (job: Job<MonitorDrainJob>) => Promise<void>;
};

export function createMonitorDrainWorker(
  connection: ConnectionOptions,
  { concurrency, process }: MonitorDrainWorkerOptions,
): Worker<MonitorDrainJob> {
  return new Worker<MonitorDrainJob>(MONITOR_DRAIN_QUEUE, process, { connection, concurrency });
}

export async function registerMonitorDrainScheduler(connection: ConnectionOptions): Promise<void> {
  const queue = new Queue<MonitorDrainJob>(MONITOR_DRAIN_QUEUE, { connection });
  try {
    await queue.upsertJobScheduler(
      'monitor-drain',
      { every: MONITOR_DRAIN_INTERVAL_MS },
      {
        name: MONITOR_DRAIN_QUEUE,
        data: { tickAt: 'scheduled' },
        opts: { removeOnComplete: { age: 3600, count: 100 }, removeOnFail: { age: 7 * 24 * 3600 } },
      },
    );
  } finally {
    await queue.close();
  }
}
