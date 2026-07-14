import {
  BullEventsProducer,
  BullMonitorSignalsProducer,
  createProducerConnectionOptions,
  type EventsProducer,
  InMemoryMonitorSignalsProducer,
  InProcessEventsProducer,
  type MonitorSignalsProducer,
} from '@metricyak/queue';
import { createDatabase } from '@metricyak/storage';
import { createApp } from './app.js';
import { startHttpServer } from './bootstrap/http.js';
import { assertSchemaReady } from './bootstrap/schema.js';
import { registerShutdown } from './bootstrap/shutdown.js';
import { startWorkers } from './bootstrap/workers.js';
import { loadConfig } from './config.js';
import { type Container, createContainer } from './container/container.js';

const config = loadConfig();
const db = createDatabase(config.databaseUrl);
await assertSchemaReady(db);

let container: Container;

let producer: EventsProducer;
if (config.runWorkerInline) {
  producer = new InProcessEventsProducer((job) => container.ingest.ingestBatch(job));
  console.log(JSON.stringify({ level: 'info', msg: 'inline worker enabled (in-process events)' }));
} else {
  if (!config.redisUrl) throw new Error('REDIS_URL is required when RUN_WORKER_INLINE is not set.');
  producer = new BullEventsProducer(createProducerConnectionOptions(config.redisUrl));
}

const signals: MonitorSignalsProducer = config.redisUrl
  ? new BullMonitorSignalsProducer(createProducerConnectionOptions(config.redisUrl))
  : new InMemoryMonitorSignalsProducer();

container = createContainer(db, producer, signals);
const app = createApp(container);

const server = startHttpServer(app, config);

const closeWorkers =
  !config.runWorkerInline && config.runWorkersInApi
    ? await startWorkers(container, config)
    : undefined;

registerShutdown(async (signal) => {
  console.log(JSON.stringify({ level: 'info', msg: `${signal} received, shutting down` }));
  await Promise.allSettled([
    new Promise<void>((resolve) => server.close(() => resolve())),
    closeWorkers?.(),
  ]);
  process.exit(0);
});
