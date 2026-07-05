import { type PublishedEvent, RedisEventBus } from '@metricyak/queue';
import { startLivestreamServer } from './bootstrap/livestream.js';
import { registerShutdown } from './bootstrap/shutdown.js';
import { loadConfig } from './config.js';

const config = loadConfig();
const eventBus = new RedisEventBus<PublishedEvent>(config.redisUrl);

const server = startLivestreamServer(eventBus, config);

registerShutdown(async (signal) => {
  console.log(
    JSON.stringify({ level: 'info', msg: `${signal} received, shutting down livestream` }),
  );
  await Promise.allSettled([
    new Promise<void>((resolve) => server.close(() => resolve())),
    eventBus.close(),
  ]);
  process.exit(0);
});
