import { logger } from 'hono/logger';
import type { Container } from './container/container.js';
import { createRouter } from './http/router.js';
import health from './routes/health.js';
import v1Router from './routes/v1/index.js';

export function createApp(container: Container) {
  const app = createRouter();

  app.use(logger());
  app.use(async (c, next) => {
    c.set('container', container);
    await next();
  });

  app.route('/v1', v1Router);
  app.route('/health', health);

  return app;
}

export type AppType = ReturnType<typeof createApp>;
