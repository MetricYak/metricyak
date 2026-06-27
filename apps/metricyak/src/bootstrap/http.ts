import { serve } from '@hono/node-server';
import type { AppType } from '../app.js';
import type { Config } from '../config.js';

export function startHttpServer(app: AppType, config: Config): void {
  serve({ fetch: app.fetch, port: config.port }, (info) => {
    console.log(
      JSON.stringify({ level: 'info', msg: 'HTTP server started', port: info.port }),
    );
  });
}
