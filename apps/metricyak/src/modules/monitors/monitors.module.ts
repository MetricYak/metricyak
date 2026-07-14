import { createMonitorTickWorker, registerMonitorTickScheduler } from '@metricyak/queue';
import { createMetricReads } from '../aggregates/aggregates.reads.js';
import type { AppModule, SchedulerFactory, WorkerFactory } from '../module.js';
import monitorsRouter from './monitors.routes.js';
import { runMonitorTick } from './monitors.tick.js';

const monitorTickWorkerFactory: WorkerFactory = (connection, container, concurrency) =>
  createMonitorTickWorker(connection, {
    concurrency,
    process: async () => {
      const result = await runMonitorTick(
        {
          db: container.db,
          metrics: container.repositories.metrics,
          metricReads: createMetricReads({ aggregates: container.aggregates }),
          monitorRuntime: container.repositories.monitorRuntime,
        },
        new Date(),
      );
      console.log(
        JSON.stringify({ level: 'info', msg: 'monitor tick', ...result }),
      );
    },
  });

const monitorTickScheduler: SchedulerFactory = (connection) =>
  registerMonitorTickScheduler(connection);

export const monitorsModule: AppModule = {
  routes: monitorsRouter,
  workers: [monitorTickWorkerFactory],
  schedulers: [monitorTickScheduler],
};
