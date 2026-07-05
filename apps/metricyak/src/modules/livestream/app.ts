import type { PublishedEvent, RedisEventBus } from '@metricyak/queue';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { streamSSE } from 'hono/streaming';
import type { Config } from '../../config.js';
import { livestreamAuth } from './auth.js';

const HEARTBEAT_MS = 15_000;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function createLivestreamApp(eventBus: RedisEventBus<PublishedEvent>, config: Config) {
  const app = new Hono();

  app.use(logger());
  app.use('*', cors({ origin: config.livestreamCorsAllowOrigins, allowMethods: ['GET'] }));
  app.use('*', livestreamAuth(config.livestreamDevToken));

  app.get('/health', (c) => c.json({ ok: true }));

  app.get('/stream/projects/:projectId/events', (c) => {
    const projectId = c.req.param('projectId');
    if (!UUID_RE.test(projectId)) {
      return c.json([{ error_type: 'validation_error', message: 'Invalid projectId.' }], 400);
    }

    return streamSSE(c, async (stream) => {
      let resolveClosed: () => void = () => {};
      const closed = new Promise<void>((resolve) => {
        resolveClosed = resolve;
      });

      const unsubscribe = eventBus.subscribe(projectId, (event) => {
        void stream.writeSSE({ data: JSON.stringify(event), id: event.id }).catch(() => {});
      });

      const heartbeat = setInterval(() => {
        void stream.writeSSE({ event: 'heartbeat', data: '' }).catch(() => {});
      }, HEARTBEAT_MS);

      stream.onAbort(() => {
        clearInterval(heartbeat);
        unsubscribe();
        resolveClosed();
      });

      await closed;
    });
  });

  return app;
}

export type LivestreamApp = ReturnType<typeof createLivestreamApp>;
