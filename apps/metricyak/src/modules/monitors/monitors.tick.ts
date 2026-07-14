import { MONITOR_TICK_INTERVAL_MS } from '@metricyak/queue';
import type { Database, MetricsRepository, MonitorRuntimeRepository } from '@metricyak/storage';
import { TOTAL_SENTINEL } from '@metricyak/storage';
import type { MetricReads } from '../aggregates/aggregates.reads.js';
import { parseDuration } from './engine/duration.js';
import { evaluateMonitor, type MonitorEvalState } from './engine/evaluate.js';

export type MonitorTickDeps = {
  db: Database;
  metrics: MetricsRepository;
  metricReads: MetricReads;
  monitorRuntime: MonitorRuntimeRepository;
};

type MonitorOutcome = 'skipped' | 'evaluated' | 'fired';

const TICK_BATCH_LIMIT = 500;

export async function runMonitorTick(
  deps: MonitorTickDeps,
  now: Date,
): Promise<{ evaluated: number; fired: number }> {
  const due = await deps.monitorRuntime.listDueMonitors(now, TICK_BATCH_LIMIT);
  const nextEvalAt = new Date(now.getTime() + MONITOR_TICK_INTERVAL_MS);
  let evaluated = 0;
  let fired = 0;

  for (const candidate of due) {
    const outcome = await deps.db.transaction<MonitorOutcome>(async (tx) => {
      const monitor = await deps.monitorRuntime.lockDueMonitor(candidate.id, now, tx);
      if (!monitor) return 'skipped';

      await deps.monitorRuntime.setNextEvalAt(monitor.id, nextEvalAt, tx);

      const metric = await deps.metrics.getDefinition(monitor.metricId, monitor.projectId);
      if (!metric) return 'evaluated';

      const window = { from: new Date(now.getTime() - parseDuration(monitor.window)), to: now };
      const { value } = await deps.metricReads.value(metric, monitor.projectId, window);

      const existing = await deps.monitorRuntime.getState(monitor.id, TOTAL_SENTINEL, tx);
      const state: MonitorEvalState = existing
        ? { status: existing.status, breachedSince: existing.breachedSince }
        : { status: 'ok', breachedSince: null };

      const result = evaluateMonitor(
        {
          condition: monitor.condition,
          holdForMs: parseDuration(monitor.holdFor),
          missingData: monitor.missingData,
        },
        state,
        value,
        now,
      );

      await deps.monitorRuntime.upsertState(
        {
          monitorId: monitor.id,
          series: TOTAL_SENTINEL,
          status: result.nextState.status,
          breachedSince: result.nextState.breachedSince,
          lastValue: value,
          lastEvaluatedAt: now,
        },
        tx,
      );

      if (!result.fired) return 'evaluated';

      await deps.monitorRuntime.insertEvent(
        {
          monitorId: monitor.id,
          series: TOTAL_SENTINEL,
          type: 'fired',
          value: result.fired.value,
          threshold: result.fired.threshold,
          occurredAt: result.fired.occurredAt,
        },
        tx,
      );
      return 'fired';
    });

    if (outcome !== 'skipped') evaluated += 1;
    if (outcome === 'fired') fired += 1;
  }

  return { evaluated, fired };
}
