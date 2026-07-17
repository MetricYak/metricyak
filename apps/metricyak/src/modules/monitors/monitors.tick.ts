import { MONITOR_TICK_INTERVAL_MS, type MonitorSignalsProducer } from '@metricyak/queue';
import type { Database, MetricsRepository, MonitorRuntimeRepository } from '@metricyak/storage';
import type { MetricReads } from '@/modules/aggregates/aggregates.reads.js';
import { evaluateMonitorRecord } from '@/modules/monitors/monitors.eval.js';
import { relayMonitorSignals } from '@/modules/monitors/monitors.relay.js';

export type MonitorTickDeps = {
  db: Database;
  metrics: MetricsRepository;
  metricReads: MetricReads;
  monitorRuntime: MonitorRuntimeRepository;
  signals: MonitorSignalsProducer;
};

type MonitorOutcome = 'skipped' | 'evaluated' | 'fired';

const TICK_BATCH_LIMIT = 500;

export async function runMonitorTick(
  deps: MonitorTickDeps,
  now: Date,
): Promise<{ evaluated: number; fired: number; relayed: number }> {
  const due = await deps.monitorRuntime.listDueMonitors(now, TICK_BATCH_LIMIT);
  const nextEvalAt = new Date(now.getTime() + MONITOR_TICK_INTERVAL_MS);
  let evaluated = 0;
  let fired = 0;

  for (const candidate of due) {
    const outcome = await deps.db.transaction<MonitorOutcome>(async (tx) => {
      const monitor = await deps.monitorRuntime.lockDueMonitor(candidate.id, now, tx);
      if (!monitor) return 'skipped';
      await deps.monitorRuntime.setNextEvalAt(monitor.id, nextEvalAt, tx);
      return evaluateMonitorRecord(
        { metrics: deps.metrics, metricReads: deps.metricReads, monitorRuntime: deps.monitorRuntime },
        monitor,
        now,
        tx,
      );
    });

    if (outcome !== 'skipped') evaluated += 1;
    if (outcome === 'fired') fired += 1;
  }

  const { relayed } = await relayMonitorSignals(
    { db: deps.db, monitorRuntime: deps.monitorRuntime, signals: deps.signals },
    now,
  );

  return { evaluated, fired, relayed };
}
