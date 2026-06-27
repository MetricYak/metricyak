import { InProcessEventsProducer } from '@metricyak/queue';
import { createDatabase } from '@metricyak/storage';
import { startWorkers } from './bootstrap/workers.js';
import { loadConfig } from './config.js';
import { createContainer } from './container/container.js';

// Workers-only entry point (scale-out: separate container from the API tier).
// Does not start an HTTP server — only boots BullMQ consumers.
//
// The container requires a producer (used by HTTP routes), but this process
// runs no routes. A no-op InProcessEventsProducer satisfies the type without
// ever being called.
const config = loadConfig();
const db = createDatabase(config.databaseUrl);
const producer = new InProcessEventsProducer(async () => {});
const container = createContainer(db, producer);

await startWorkers(container, config);
