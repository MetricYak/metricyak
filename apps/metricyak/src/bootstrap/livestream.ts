import type { ServerType } from '@hono/node-server';
import { serve } from '@hono/node-server';
import type { PublishedEvent, RedisEventBus } from '@metricyak/queue';
import type { Config } from '../config.js';
import { createLivestreamApp } from '../modules/livestream/app.js';

export function startLivestreamServer(
  eventBus: RedisEventBus<PublishedEvent>,
  config: Config,
): ServerType {
  const app = createLivestreamApp(eventBus, config);

  return serve({ fetch: app.fetch, port: config.livestreamPort }, (info) => {
    console.log(
      JSON.stringify({ level: 'info', msg: 'livestream server started', port: info.port }),
    );
  });
}
