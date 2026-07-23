import {
  createMonitorBackstopWorker,
  createMonitorDispatchWorker,
  createMonitorDrainWorker,
  createMonitorEvalWorker,
  createMonitorRelayWorker,
  createMonitorSignalsWorker,
  registerMonitorBackstopScheduler,
  registerMonitorDispatchScheduler,
  registerMonitorDrainScheduler,
  registerMonitorRelayScheduler,
} from '@metricyak/queue';
import type { AppModule, SchedulerFactory, WorkerFactory } from '@/modules/module.js';
import { runMonitorBackstop } from '@/modules/monitors/monitors.backstop.js';
import { runMonitorDispatch } from '@/modules/monitors/monitors.dispatch.js';
import { runMonitorDrain } from '@/modules/monitors/monitors.drain.js';
import { processMonitorEvalJob } from '@/modules/monitors/monitors.eval.js';
import { relayMonitorSignals } from '@/modules/monitors/monitors.relay.js';
import monitorsRouter from '@/modules/monitors/monitors.routes.js';
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
      await processMonitorEvalJob(
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
        {
          db: container.db,
          monitorRuntime: container.repos.monitorRuntime,
          signals: container.signals,
        },
        new Date(),
      );
      if (relay.relayed > 0)
        console.log(JSON.stringify({ level: 'info', msg: 'monitor relay', ...relay }));
    },
  });

const monitorDrainWorkerFactory: WorkerFactory = (connection, container, concurrency) =>
  createMonitorDrainWorker(connection, {
    concurrency,
    process: async () => {
      const drain = await runMonitorDrain(
        {
          dirty: container.dirty,
          monitorEventKeys: container.repos.monitorEventKeys,
          evalProducer: container.evalProducer,
        },
        new Date(),
      );
      if (drain.enqueued > 0)
        console.log(JSON.stringify({ level: 'info', msg: 'monitor drain', ...drain }));
    },
  });

const monitorBackstopWorkerFactory: WorkerFactory = (connection, container, concurrency) =>
  createMonitorBackstopWorker(connection, {
    concurrency,
    process: async () => {
      const backstop = await runMonitorBackstop(
        {
          monitors: container.repos.monitors,
          monitorEventKeys: container.repos.monitorEventKeys,
          dirty: container.dirty,
          evalProducer: container.evalProducer,
        },
        new Date(),
      );
      if (backstop.enqueued > 0)
        console.log(JSON.stringify({ level: 'info', msg: 'monitor backstop', ...backstop }));
    },
  });

const monitorDispatchScheduler: SchedulerFactory = (connection) =>
  registerMonitorDispatchScheduler(connection);

const monitorRelayScheduler: SchedulerFactory = (connection) =>
  registerMonitorRelayScheduler(connection);

const monitorDrainScheduler: SchedulerFactory = (connection) =>
  registerMonitorDrainScheduler(connection);

const monitorBackstopScheduler: SchedulerFactory = (connection) =>
  registerMonitorBackstopScheduler(connection);

export const monitorsModule: AppModule = {
  routes: monitorsRouter,
  workers: [
    monitorDispatchWorkerFactory,
    monitorEvalWorkerFactory,
    monitorRelayWorkerFactory,
    monitorSignalsWorkerFactory,
    monitorDrainWorkerFactory,
    monitorBackstopWorkerFactory,
  ],
  schedulers: [
    monitorDispatchScheduler,
    monitorRelayScheduler,
    monitorDrainScheduler,
    monitorBackstopScheduler,
  ],
};
