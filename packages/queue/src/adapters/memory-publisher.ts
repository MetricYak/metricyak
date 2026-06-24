import type { EventPublisher } from '../publisher.js';

export class MemoryPublisher implements EventPublisher {
  readonly messages: Array<{ topic: string; message: unknown }> = [];

  async publish(topic: string, message: unknown): Promise<void> {
    this.messages.push({ topic, message });
  }
}
