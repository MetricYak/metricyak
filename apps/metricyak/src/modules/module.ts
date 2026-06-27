import type { OpenAPIHono } from '@hono/zod-openapi';
import type { ConnectionOptions, Worker } from '@metricyak/queue';
import type { AppEnv, Container } from '../container/container.js';

/**
 * A WorkerFactory creates a fully-configured BullMQ Worker for a domain.
 * The factory receives the Redis connection, the DI container, and the
 * desired concurrency. It owns:
 *   - binding the handler to the right queue
 *   - any domain-specific dead-letter / error handling
 *
 * Generic logging (failed) and graceful shutdown are applied centrally by
 * startWorkers() on every Worker returned by any factory.
 */
export type WorkerFactory = (
  connection: ConnectionOptions,
  container: Container,
  concurrency: number,
) => Worker;

/**
 * The contract every feature domain implements to register itself.
 *
 * routes   – mounted under /v1 by app.ts (optional; pure-worker domains omit this)
 * workers  – one WorkerFactory per background queue (optional; HTTP-only domains omit this)
 *
 * Add a domain: create its module folder, implement AppModule, export it from
 * modules/index.ts. No other boot code changes are required.
 */
export type AppModule = {
  readonly routes?: OpenAPIHono<AppEnv>;
  readonly workers?: readonly WorkerFactory[];
};
