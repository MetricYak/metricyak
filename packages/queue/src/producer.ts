import { createHash } from 'node:crypto';
import type { ConnectionOptions } from 'bullmq';
import { Queue } from 'bullmq';
import { EVENTS_QUEUE, type EventBatchJob } from './queues.js';

export interface EventsProducer {
  enqueue(job: EventBatchJob): Promise<void>;
}

export class BullEventsProducer implements EventsProducer {
  private readonly queue: Queue<EventBatchJob>;

  constructor(connection: ConnectionOptions) {
    this.queue = new Queue<EventBatchJob>(EVENTS_QUEUE, { connection });
  }

  async enqueue(job: EventBatchJob): Promise<void> {
    const jobId = createHash('sha256')
      .update(
        job.events
          .map((e) => e.id)
          .sort()
          .join(','),
      )
      .digest('hex');

    await this.queue.add(EVENTS_QUEUE, job, {
      jobId,
      attempts: 3,
      backoff: { type: 'exponential', delay: 1000 },
    });
  }
}

export class InMemoryEventsProducer implements EventsProducer {
  readonly jobs: EventBatchJob[] = [];

  async enqueue(job: EventBatchJob): Promise<void> {
    this.jobs.push(job);
  }
}
