import { Redis } from 'ioredis';

export type EventBusHandler<T> = (payload: T) => void;

export class RedisEventBus<T = unknown> {
  private readonly publisher: Redis;
  private readonly subscriber: Redis;
  private readonly handlers = new Map<string, Set<EventBusHandler<T>>>();
  private readonly channelPrefix: string;

  constructor(redisUrl: string, options: { channelPrefix?: string } = {}) {
    this.channelPrefix = options.channelPrefix ?? 'events';
    this.publisher = new Redis(redisUrl, { maxRetriesPerRequest: 1 });
    this.subscriber = new Redis(redisUrl, { maxRetriesPerRequest: null });

    this.subscriber.on('message', (channel: string, raw: string) => {
      const handlers = this.handlers.get(channel);
      if (!handlers || handlers.size === 0) return;

      let payload: T;
      try {
        payload = JSON.parse(raw) as T;
      } catch {
        return;
      }
      for (const handler of handlers) handler(payload);
    });
  }

  private channel(scopeId: string): string {
    return `${this.channelPrefix}:${scopeId}`;
  }

  async publish(scopeId: string, payload: T): Promise<void> {
    await this.publisher.publish(this.channel(scopeId), JSON.stringify(payload));
  }

  subscribe(scopeId: string, handler: EventBusHandler<T>): () => void {
    const channel = this.channel(scopeId);
    let handlers = this.handlers.get(channel);
    if (!handlers) {
      handlers = new Set();
      this.handlers.set(channel, handlers);
      void this.subscriber.subscribe(channel);
    }
    handlers.add(handler);

    let unsubscribed = false;
    return () => {
      if (unsubscribed) return;
      unsubscribed = true;
      const current = this.handlers.get(channel);
      if (!current) return;
      current.delete(handler);
      if (current.size === 0) {
        this.handlers.delete(channel);
        void this.subscriber.unsubscribe(channel);
      }
    };
  }

  async close(): Promise<void> {
    await Promise.allSettled([this.publisher.quit(), this.subscriber.quit()]);
  }
}
