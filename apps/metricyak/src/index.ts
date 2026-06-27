import {
  BullEventsProducer,
  createProducerConnectionOptions,
  type EventsProducer,
  InProcessEventsProducer,
} from '@metricyak/queue';
import { createDatabase, EventsRepository } from '@metricyak/storage';
import { createApp } from './app.js';
import { startHttpServer } from './bootstrap/http.js';
import { startWorkers } from './bootstrap/workers.js';
import { loadConfig } from './config.js';
import { createContainer } from './container/container.js';
import { processEventBatch } from './modules/events/events.worker.js';

const config = loadConfig();
const db = createDatabase(config.databaseUrl);

let producer: EventsProducer;
if (config.runWorkerInline) {
  // Local-dev mode: call the event handler directly, no Redis required.
  const eventsRepo = new EventsRepository(db);
  producer = new InProcessEventsProducer((job) => processEventBatch(job, eventsRepo));
  console.log(JSON.stringify({ level: 'info', msg: 'inline worker enabled (in-process events)' }));
} else {
  if (!config.redisUrl) throw new Error('REDIS_URL is required when RUN_WORKER_INLINE is not set.');
  producer = new BullEventsProducer(createProducerConnectionOptions(config.redisUrl));
}

const container = createContainer(db, producer);
const app = createApp(container);

startHttpServer(app, config);

// Self-host single-deploy (default): boot workers in the same process as HTTP.
// To run workers separately (scale-out), set RUN_WORKERS_IN_API=false and use worker.ts.
if (!config.runWorkerInline && config.runWorkersInApi) {
  await startWorkers(container, config);
}
