import { InProcessEventsProducer, type PublishedEvent, RedisEventBus } from '@metricyak/queue';
import { createDatabase } from '@metricyak/storage';
import { registerShutdown } from './bootstrap/shutdown.js';
import { startWorkers } from './bootstrap/workers.js';
import { loadConfig } from './config.js';
import { createContainer } from './container/container.js';

const config = loadConfig();
const db = createDatabase(config.databaseUrl);
const eventBus = new RedisEventBus<PublishedEvent>(config.redisUrl);
const producer = new InProcessEventsProducer(async () => {});
const container = createContainer(db, producer, eventBus);

const closeWorkers = await startWorkers(container, config);

registerShutdown(async (signal) => {
  console.log(JSON.stringify({ level: 'info', msg: `${signal} received, shutting down workers` }));
  await closeWorkers();
  await eventBus.close();
  process.exit(0);
});
