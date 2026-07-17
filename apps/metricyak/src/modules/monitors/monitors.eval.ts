import type {
  Database,
  Executor,
  MetricsRepository,
  MonitorRecord,
  MonitorRuntimeRepository,
} from '@metricyak/storage';
import { TOTAL_SENTINEL } from '@metricyak/storage';
import type { MetricReads } from '@/modules/aggregates/aggregates.reads.js';
import { parseDuration } from '@/modules/monitors/engine/duration.js';
import { evaluateMonitor, type MonitorEvalState } from '@/modules/monitors/engine/evaluate.js';

export type MonitorEvalCoreDeps = {
  metrics: MetricsRepository;
  metricReads: MetricReads;
  monitorRuntime: MonitorRuntimeRepository;
};

export type MonitorEvalOutcome = 'evaluated' | 'fired';

export async function evaluateMonitorRecord(
  deps: MonitorEvalCoreDeps,
  monitor: MonitorRecord,
  now: Date,
  tx: Executor,
): Promise<MonitorEvalOutcome> {
  const metric = await deps.metrics.getDefinition(monitor.metricId, monitor.projectId);
  if (!metric) {
    console.log(
      JSON.stringify({
        level: 'warn',
        msg: 'monitor metric unavailable',
        monitorId: monitor.id,
        metricId: monitor.metricId,
      }),
    );
    return 'evaluated';
  }

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
}

export type MonitorEvalDeps = MonitorEvalCoreDeps & { db: Database };

export async function runMonitorEval(
  deps: MonitorEvalDeps,
  monitorId: string,
  now: Date,
): Promise<MonitorEvalOutcome | 'skipped'> {
  return deps.db.transaction(async (tx) => {
    const monitor = await deps.monitorRuntime.lockMonitorForEval(monitorId, tx);
    if (!monitor) return 'skipped';
    return evaluateMonitorRecord(deps, monitor, now, tx);
  });
}
