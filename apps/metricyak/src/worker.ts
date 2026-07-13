import { InProcessEventsProducer } from '@metricyak/queue';
import { createDatabase } from '@metricyak/storage';
import { assertSchemaReady } from './bootstrap/schema.js';
import { registerShutdown } from './bootstrap/shutdown.js';
import { startWorkers } from './bootstrap/workers.js';
import { loadConfig } from './config.js';
import { createContainer } from './container/container.js';

const config = loadConfig();
const db = createDatabase(config.databaseUrl);
await assertSchemaReady(db);
const producer = new InProcessEventsProducer(async () => {});
const container = createContainer(db, producer);

const closeWorkers = await startWorkers(container, config);

registerShutdown(async (signal) => {
  console.log(JSON.stringify({ level: 'info', msg: `${signal} received, shutting down workers` }));
  await closeWorkers();
  process.exit(0);
});
