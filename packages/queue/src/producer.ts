import type { ConnectionOptions } from 'bullmq';
import { Queue } from 'bullmq';
import {
  EVENTS_QUEUE,
  type EventBatchJob,
  MONITOR_EVAL_QUEUE,
  MONITOR_SIGNALS_QUEUE,
  type MonitorEvalJob,
  type MonitorSignalJob,
} from '@/queues.js';

export interface EventsProducer {
  enqueue(job: EventBatchJob): Promise<void>;
}

export class BullEventsProducer implements EventsProducer {
  private readonly queue: Queue<EventBatchJob>;

  constructor(connection: ConnectionOptions) {
    this.queue = new Queue<EventBatchJob>(EVENTS_QUEUE, { connection });
  }

  async enqueue(job: EventBatchJob): Promise<void> {
    await this.queue.add(EVENTS_QUEUE, job, {
      jobId: job.batchId,
      attempts: 3,
      backoff: { type: 'exponential', delay: 1000 },
      removeOnComplete: { age: 3600, count: 10_000 },
      removeOnFail: { age: 7 * 24 * 3600 },
    });
  }
}

export class InMemoryEventsProducer implements EventsProducer {
  readonly jobs: EventBatchJob[] = [];

  async enqueue(job: EventBatchJob): Promise<void> {
    this.jobs.push(job);
  }
}

export type EventBatchHandler = (job: EventBatchJob) => Promise<void>;

export class InProcessEventsProducer implements EventsProducer {
  constructor(private readonly handler: EventBatchHandler) {}

  async enqueue(job: EventBatchJob): Promise<void> {
    void this.handler(job).catch((err) => {
      console.log(
        JSON.stringify({
          level: 'error',
          msg: 'inline event processing failed',
          projectId: job.projectId,
          error: (err as Error).message,
        }),
      );
    });
  }
}

export interface MonitorSignalsProducer {
  enqueue(job: MonitorSignalJob): Promise<void>;
}

export class BullMonitorSignalsProducer implements MonitorSignalsProducer {
  private readonly queue: Queue<MonitorSignalJob>;

  constructor(connection: ConnectionOptions) {
    this.queue = new Queue<MonitorSignalJob>(MONITOR_SIGNALS_QUEUE, { connection });
  }

  async enqueue(job: MonitorSignalJob): Promise<void> {
    await this.queue.add(MONITOR_SIGNALS_QUEUE, job, {
      jobId: job.eventId,
      attempts: 5,
      backoff: { type: 'exponential', delay: 1000 },
      removeOnComplete: { age: 7 * 24 * 3600, count: 10_000 },
      removeOnFail: { age: 30 * 24 * 3600 },
    });
  }
}

export class InMemoryMonitorSignalsProducer implements MonitorSignalsProducer {
  readonly jobs: MonitorSignalJob[] = [];

  async enqueue(job: MonitorSignalJob): Promise<void> {
    this.jobs.push(job);
  }
}

export interface MonitorEvalProducer {
  enqueueBulk(monitorIds: readonly string[]): Promise<void>;
}

export class BullMonitorEvalProducer implements MonitorEvalProducer {
  private readonly queue: Queue<MonitorEvalJob>;

  constructor(connection: ConnectionOptions) {
    this.queue = new Queue<MonitorEvalJob>(MONITOR_EVAL_QUEUE, { connection });
  }

  async enqueueBulk(monitorIds: readonly string[]): Promise<void> {
    if (monitorIds.length === 0) return;
    await this.queue.addBulk(
      monitorIds.map((monitorId) => ({
        name: MONITOR_EVAL_QUEUE,
        data: { monitorId },
        opts: {
          jobId: monitorId, // dedup: BullMQ rejects a duplicate active job for the same monitor
          attempts: 3,
          backoff: { type: 'exponential' as const, delay: 1000 },
          removeOnComplete: true, // keep Redis footprint bounded at high job rates
          removeOnFail: { age: 24 * 3600 },
        },
      })),
    );
  }
}

export class InMemoryMonitorEvalProducer implements MonitorEvalProducer {
  readonly jobs: MonitorEvalJob[] = [];

  async enqueueBulk(monitorIds: readonly string[]): Promise<void> {
    for (const monitorId of monitorIds) this.jobs.push({ monitorId });
  }
}
