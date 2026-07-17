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
    // A missing/deleted metric definition is a persistent, monitor-specific failure —
    // surface it via the health counter rather than silently returning.
    throw new Error(`monitor metric unavailable: ${monitor.metricId}`);
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

  if (monitor.consecutiveFailures > 0 || monitor.evalHealth !== 'ok') {
    await deps.monitorRuntime.resetEvalHealth(monitor.id, tx);
  }

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

/**
 * Worker entry point: run the eval, and on failure record it out-of-band (its own
 * transaction, since the eval transaction rolled back) before rethrowing so BullMQ
 * still marks the job failed and the `failed` handler logs it.
 */
export async function processMonitorEvalJob(
  deps: MonitorEvalDeps,
  monitorId: string,
  now: Date,
): Promise<MonitorEvalOutcome | 'skipped'> {
  try {
    return await runMonitorEval(deps, monitorId, now);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    try {
      await deps.monitorRuntime.recordEvalFailure(monitorId, message, now);
    } catch (recordErr) {
      console.log(
        JSON.stringify({
          level: 'error',
          msg: 'failed to record monitor eval failure',
          monitorId,
          error: recordErr instanceof Error ? recordErr.message : String(recordErr),
        }),
      );
    }
    throw err;
  }
}
