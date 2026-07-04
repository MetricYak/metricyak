import { createWorkerConnectionOptions, type Job, type Worker } from '@metricyak/queue';
import type { Config } from '../config.js';
import type { Container } from '../container/container.js';
import {
  DEFAULT_ROLLUP_INTERVAL_MS,
  startRollupScheduler,
} from '../modules/aggregates/rollup.worker.js';
import { modules } from '../modules/index.js';

export async function startWorkers(
  container: Container,
  config: Config,
): Promise<() => Promise<void>> {
  if (!config.redisUrl) {
    throw new Error('REDIS_URL is required to run workers.');
  }

  const connection = createWorkerConnectionOptions(config.redisUrl);
  const workerFactories = modules.flatMap((mod) => mod.workers ?? []);

  const workers: Worker[] = workerFactories.map((factory) =>
    factory(connection, container, config.workerConcurrency),
  );

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

  const stopRollup = startRollupScheduler(
    { db: container.db, aggregates: container.aggregates, metrics: container.repositories.metrics },
    DEFAULT_ROLLUP_INTERVAL_MS,
  );

  console.log(
    JSON.stringify({
      level: 'info',
      msg: 'workers started',
      count: workers.length,
      concurrency: config.workerConcurrency,
    }),
  );

  return () => {
    stopRollup();
    return Promise.all(workers.map((w) => w.close())).then(() => undefined);
  };
}
