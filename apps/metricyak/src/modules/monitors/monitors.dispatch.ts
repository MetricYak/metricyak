import { MONITOR_DISPATCH_INTERVAL_MS, type MonitorEvalProducer } from '@metricyak/queue';
import type { MonitorRuntimeRepository } from '@metricyak/storage';

export type MonitorDispatchDeps = {
  monitorRuntime: MonitorRuntimeRepository;
  evalProducer: MonitorEvalProducer;
};

const CLAIM_BATCH = 1000;
const MAX_BATCHES_PER_TICK = 1000; // safety cap (~1M monitors/tick) so a wedged eval pool can't spin forever

export async function runMonitorDispatch(
  deps: MonitorDispatchDeps,
  now: Date,
): Promise<{ dispatched: number }> {
  let dispatched = 0;
  for (let batch = 0; batch < MAX_BATCHES_PER_TICK; batch++) {
    const claimed = await deps.monitorRuntime.claimDueMonitors(
      now,
      MONITOR_DISPATCH_INTERVAL_MS,
      CLAIM_BATCH,
    );
    if (claimed.length === 0) break;
    await deps.evalProducer.enqueueBulk(
      claimed.map((m) => ({ monitorId: m.id, nextEvalAt: m.nextEvalAt })),
    );
    dispatched += claimed.length;
    if (batch === MAX_BATCHES_PER_TICK - 1) {
      console.log(
        JSON.stringify({ level: 'warn', msg: 'monitor dispatch hit batch cap', dispatched }),
      );
    }
  }
  return { dispatched };
}
