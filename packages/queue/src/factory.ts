import type { Database } from '@metricyak/storage';
import { MemoryPublisher } from './adapters/memory-publisher.js';
import { PostgresPublisher } from './adapters/postgres-publisher.js';
import type { EventPublisher } from './publisher.js';

export type QueueDriver = 'postgres' | 'memory';

export type QueueConfig = {
  driver: QueueDriver;
};

export function createPublisher(config: QueueConfig, db: Database): EventPublisher {
  switch (config.driver) {
    case 'postgres':
      return new PostgresPublisher(db);
    case 'memory':
      return new MemoryPublisher();
  }
}
