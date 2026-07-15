import {
  createMonitorSignalsWorker,
  createMonitorTickWorker,
  registerMonitorTickScheduler,
} from '@metricyak/queue';
import type { AppModule, SchedulerFactory, WorkerFactory } from '@/modules/module.js';
import monitorsRouter from '@/modules/monitors/monitors.routes.js';
import { processMonitorSignal } from '@/modules/monitors/monitors.signals.worker.js';
import { runMonitorTick } from '@/modules/monitors/monitors.tick.js';

const monitorTickWorkerFactory: WorkerFactory = (connection, container, concurrency) =>
  createMonitorTickWorker(connection, {
    concurrency,
    process: async () => {
      const result = await runMonitorTick(
        {
          db: container.db,
          metrics: container.repos.metrics,
          metricReads: container.reads,
          monitorRuntime: container.repos.monitorRuntime,
          signals: container.signals,
        },
        new Date(),
      );
      console.log(JSON.stringify({ level: 'info', msg: 'monitor tick', ...result }));
    },
  });

const monitorTickScheduler: SchedulerFactory = (connection) =>
  registerMonitorTickScheduler(connection);

const monitorSignalsWorkerFactory: WorkerFactory = (connection, _container, concurrency) =>
  createMonitorSignalsWorker(connection, {
    concurrency,
    process: (job) => processMonitorSignal(job.data),
  });

export const monitorsModule: AppModule = {
  routes: monitorsRouter,
  workers: [monitorTickWorkerFactory, monitorSignalsWorkerFactory],
  schedulers: [monitorTickScheduler],
};
