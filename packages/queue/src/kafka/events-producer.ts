import type { Kafka, Producer } from 'kafkajs';
import { TOPICS } from '@/kafka/topics.js';
import type { EventsProducer } from '@/producer.js';
import type { EventBatchJob } from '@/queues.js';

export class KafkaEventsProducer implements EventsProducer {
  private readonly producer: Producer;

  constructor(kafka: Kafka) {
    this.producer = kafka.producer();
  }

  async connect(): Promise<void> {
    await this.producer.connect();
  }

  async enqueue(job: EventBatchJob): Promise<void> {
    await this.producer.send({
      topic: TOPICS.eventsRaw,
      messages: job.events.map((event) => ({
        key: event.insertId ?? event.id,
        value: JSON.stringify({ ...event, projectId: job.projectId, batchId: job.batchId }),
      })),
    });
  }

  async disconnect(): Promise<void> {
    await this.producer.disconnect();
  }
}
