import { logger } from 'hono/logger';
import type { Container } from './container/container.js';
import { createRouter } from './http/router.js';
import { modules } from './modules/index.js';
import health from './routes/health.js';

export function createApp(container: Container) {
  const app = createRouter();

  app.use(logger());
  app.use(async (c, next) => {
    c.set('container', container);
    await next();
  });

  // Mount each module's routes under /v1. Modules without routes are skipped.
  for (const mod of modules) {
    if (mod.routes) {
      app.route('/v1', mod.routes);
    }
  }

  app.route('/health', health);

  return app;
}

export type AppType = ReturnType<typeof createApp>;
