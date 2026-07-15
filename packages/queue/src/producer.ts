import type { ConnectionOptions } from 'bullmq';
import { Queue } from 'bullmq';
import {
  EVENTS_QUEUE,
  type EventBatchJob,
  MONITOR_SIGNALS_QUEUE,
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
