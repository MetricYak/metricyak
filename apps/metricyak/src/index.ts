import {
  BullEventsProducer,
  createProducerConnectionOptions,
  type EventsProducer,
  InProcessEventsProducer,
} from '@metricyak/queue';
import { createDatabase } from '@metricyak/storage';
import { createApp } from './app.js';
import { startHttpServer } from './bootstrap/http.js';
import { registerShutdown } from './bootstrap/shutdown.js';
import { startWorkers } from './bootstrap/workers.js';
import { loadConfig } from './config.js';
import { type Container, createContainer } from './container/container.js';
import {
  DEFAULT_ROLLUP_INTERVAL_MS,
  startRollupScheduler,
} from './modules/aggregates/rollup.worker.js';
import { processEventBatch } from './modules/events/events.worker.js';

const config = loadConfig();
const db = createDatabase(config.databaseUrl);

let container: Container;

let producer: EventsProducer;
if (config.runWorkerInline) {
  producer = new InProcessEventsProducer((job) =>
    processEventBatch(job, {
      db: container.db,
      events: container.events,
      aggregates: container.aggregates,
      matcher: container.matcher,
    }),
  );
  console.log(JSON.stringify({ level: 'info', msg: 'inline worker enabled (in-process events)' }));
} else {
  if (!config.redisUrl) throw new Error('REDIS_URL is required when RUN_WORKER_INLINE is not set.');
  producer = new BullEventsProducer(createProducerConnectionOptions(config.redisUrl));
}

container = createContainer(db, producer);
const app = createApp(container);

const server = startHttpServer(app, config);

const closeWorkers =
  !config.runWorkerInline && config.runWorkersInApi
    ? await startWorkers(container, config)
    : undefined;

const stopRollup = config.runWorkerInline
  ? startRollupScheduler(
      {
        db: container.db,
        aggregates: container.aggregates,
        metrics: container.repositories.metrics,
      },
      DEFAULT_ROLLUP_INTERVAL_MS,
    )
  : undefined;

registerShutdown(async (signal) => {
  console.log(JSON.stringify({ level: 'info', msg: `${signal} received, shutting down` }));
  stopRollup?.();
  await Promise.allSettled([
    new Promise<void>((resolve) => server.close(() => resolve())),
    closeWorkers?.(),
  ]);
  process.exit(0);
});
