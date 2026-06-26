import { serve } from '@hono/node-server';
import { BullEventsProducer, createProducerConnectionOptions } from '@metricyak/queue';
import { createDatabase } from '@metricyak/storage';
import { createApp } from './app.js';
import { loadConfig } from './config.js';
import { createContainer } from './container/container.js';

const config = loadConfig();
const db = createDatabase(config.databaseUrl);
const producer = new BullEventsProducer(createProducerConnectionOptions(config.redisUrl));
const app = createApp(createContainer(db, producer));

serve({ fetch: app.fetch, port: config.port }, (info) => {
  console.log(`Server running on http://localhost:${info.port}`);
});
