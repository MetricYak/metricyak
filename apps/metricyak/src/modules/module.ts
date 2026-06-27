import type { OpenAPIHono } from '@hono/zod-openapi';
import type { ConnectionOptions, Worker } from '@metricyak/queue';
import type { AppEnv, Container } from '../container/container.js';

export type WorkerFactory = (
  connection: ConnectionOptions,
  container: Container,
  concurrency: number,
) => Worker;

export type AppModule = {
  readonly routes?: OpenAPIHono<AppEnv>;
  readonly workers?: readonly WorkerFactory[];
};
