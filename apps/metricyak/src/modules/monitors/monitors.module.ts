import {
  createMonitorDispatchWorker,
  createMonitorEvalWorker,
  createMonitorRelayWorker,
  createMonitorSignalsWorker,
  registerMonitorDispatchScheduler,
  registerMonitorRelayScheduler,
} from '@metricyak/queue';
import type { AppModule, SchedulerFactory, WorkerFactory } from '@/modules/module.js';
import monitorsRouter from '@/modules/monitors/monitors.routes.js';
import { runMonitorDispatch } from '@/modules/monitors/monitors.dispatch.js';
import { runMonitorEval } from '@/modules/monitors/monitors.eval.js';
import { relayMonitorSignals } from '@/modules/monitors/monitors.relay.js';
import { processMonitorSignal } from '@/modules/monitors/monitors.signals.worker.js';

const monitorDispatchWorkerFactory: WorkerFactory = (connection, container, concurrency) =>
  createMonitorDispatchWorker(connection, {
    concurrency,
    process: async () => {
      const now = new Date();
      const dispatch = await runMonitorDispatch(
        { monitorRuntime: container.repos.monitorRuntime, evalProducer: container.evalProducer },
        now,
      );
      console.log(JSON.stringify({ level: 'info', msg: 'monitor dispatch', ...dispatch }));
    },
  });

const monitorEvalWorkerFactory: WorkerFactory = (connection, container, concurrency) =>
  createMonitorEvalWorker(connection, {
    concurrency,
    process: async (job) => {
      await runMonitorEval(
        {
          db: container.db,
          metrics: container.repos.metrics,
          metricReads: container.reads,
          monitorRuntime: container.repos.monitorRuntime,
        },
        job.data.monitorId,
        new Date(),
      );
    },
  });

const monitorSignalsWorkerFactory: WorkerFactory = (connection, _container, concurrency) =>
  createMonitorSignalsWorker(connection, {
    concurrency,
    process: (job) => processMonitorSignal(job.data),
  });

const monitorRelayWorkerFactory: WorkerFactory = (connection, container, concurrency) =>
  createMonitorRelayWorker(connection, {
    concurrency,
    process: async () => {
      const relay = await relayMonitorSignals(
        { db: container.db, monitorRuntime: container.repos.monitorRuntime, signals: container.signals },
        new Date(),
      );
      if (relay.relayed > 0) console.log(JSON.stringify({ level: 'info', msg: 'monitor relay', ...relay }));
    },
  });

const monitorDispatchScheduler: SchedulerFactory = (connection) =>
  registerMonitorDispatchScheduler(connection);

const monitorRelayScheduler: SchedulerFactory = (connection) => registerMonitorRelayScheduler(connection);

export const monitorsModule: AppModule = {
  routes: monitorsRouter,
  workers: [
    monitorDispatchWorkerFactory,
    monitorEvalWorkerFactory,
    monitorRelayWorkerFactory,
    monitorSignalsWorkerFactory,
  ],
  schedulers: [monitorDispatchScheduler, monitorRelayScheduler],
};
