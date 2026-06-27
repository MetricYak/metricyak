import {
  BullEventsProducer,
  createProducerConnectionOptions,
  type EventsProducer,
  InProcessEventsProducer,
} from '@metricyak/queue';
import { createDatabase, EventsRepository } from '@metricyak/storage';
import { createApp } from './app.js';
import { startHttpServer } from './bootstrap/http.js';
import { registerShutdown } from './bootstrap/shutdown.js';
import { startWorkers } from './bootstrap/workers.js';
import { loadConfig } from './config.js';
import { createContainer } from './container/container.js';
import { processEventBatch } from './modules/events/events.worker.js';

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

const container = createContainer(db, producer);
const app = createApp(container);

const server = startHttpServer(app, config);

const closeWorkers =
  !config.runWorkerInline && config.runWorkersInApi
    ? await startWorkers(container, config)
    : undefined;

registerShutdown(async (signal) => {
  console.log(JSON.stringify({ level: 'info', msg: `${signal} received, shutting down` }));
  await Promise.all([
    new Promise<void>((resolve) => server.close(() => resolve())),
    closeWorkers?.(),
  ]);
  process.exit(0);
});
