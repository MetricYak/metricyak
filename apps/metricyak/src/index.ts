import { serve } from '@hono/node-server';
import {
  BullEventsProducer,
  createProducerConnectionOptions,
  type EventsProducer,
  InProcessEventsProducer,
} from '@metricyak/queue';
import { createDatabase, EventsRepository } from '@metricyak/storage';
import { createApp } from './app.js';
import { loadConfig } from './config.js';
import { createContainer } from './container/container.js';
import { processEventBatch } from './worker/process-events.js';

const config = loadConfig();
const db = createDatabase(config.databaseUrl);

let producer: EventsProducer;
if (config.runWorkerInline) {
  const eventsRepo = new EventsRepository(db);
  producer = new InProcessEventsProducer((job) => processEventBatch(job, eventsRepo));
  console.log(JSON.stringify({ level: 'info', msg: 'inline worker enabled (in-process events)' }));
} else {
  if (!config.redisUrl) throw new Error('REDIS_URL is required when RUN_WORKER_INLINE is not set.');
  producer = new BullEventsProducer(createProducerConnectionOptions(config.redisUrl));
}

const app = createApp(createContainer(db, producer));

serve({ fetch: app.fetch, port: config.port }, (info) => {
  console.log(`Server running on http://localhost:${info.port}`);
});
