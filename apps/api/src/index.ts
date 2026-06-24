import { serve } from '@hono/node-server';
import { createPublisher } from '@metricyak/queue';
import { createDatabase } from '@metricyak/storage';
import { createApp } from './app.js';
import { loadConfig } from './config.js';
import { createContainer } from './container/container.js';

const config = loadConfig();
const db = createDatabase(config.databaseUrl);
const publisher = createPublisher({ driver: config.queueDriver }, db);
const app = createApp(createContainer(db, publisher));

serve({ fetch: app.fetch, port: config.port }, (info) => {
  console.log(`Server running on http://localhost:${info.port}`);
});
