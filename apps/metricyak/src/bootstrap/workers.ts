import { createWorkerConnectionOptions, type Job, type Worker } from '@metricyak/queue';
import type { Config } from '../config.js';
import type { Container } from '../container/container.js';
import { modules } from '../modules/index.js';
import { registerShutdown } from './shutdown.js';

/**
 * Boots every worker registered across all modules and wires up:
 *   - generic failed logging (domain modules add their own event-specific handling)
 *   - graceful shutdown on SIGTERM / SIGINT
 *
 * Requires REDIS_URL in config (validated by loadConfig()).
 * Called by index.ts when runWorkersInApi=true (self-host single-deploy)
 * and directly by worker.ts for the scale-out workers-only process.
 */
export async function startWorkers(container: Container, config: Config): Promise<void> {
  if (!config.redisUrl) {
    throw new Error('REDIS_URL is required to run workers.');
  }

  const connection = createWorkerConnectionOptions(config.redisUrl);
  const workerFactories = modules.flatMap((mod) => mod.workers ?? []);

  const workers: Worker[] = workerFactories.map((factory) =>
    factory(connection, container, config.workerConcurrency),
  );

  // Generic failed logging applied to every worker regardless of domain.
  // Domain modules (e.g. events) attach their own 'failed' listener on top
  // for domain-specific handling like dead-lettering.
  for (const worker of workers) {
    worker.on('failed', (job: Job | undefined, err: Error) => {
      const maxAttempts = job?.opts?.attempts ?? 1;
      const exhausted = (job?.attemptsMade ?? 0) >= maxAttempts;
      console.log(
        JSON.stringify({
          level: 'error',
          msg: exhausted ? 'job failed (exhausted)' : 'job failed (will retry)',
          jobId: job?.id,
          queue: worker.name,
          attemptsMade: job?.attemptsMade,
          maxAttempts,
          error: err.message,
        }),
      );
    });
  }

  console.log(
    JSON.stringify({
      level: 'info',
      msg: 'workers started',
      count: workers.length,
      concurrency: config.workerConcurrency,
    }),
  );

  registerShutdown(async (signal) => {
    console.log(
      JSON.stringify({ level: 'info', msg: `${signal} received, shutting down workers` }),
    );
    await Promise.all(workers.map((w) => w.close()));
    process.exit(0);
  });
}
