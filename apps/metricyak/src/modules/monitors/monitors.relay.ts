import type { MonitorFiringsProducer } from '@metricyak/queue';
import type { Database, MonitorRuntimeRepository } from '@metricyak/storage';

export type MonitorRelayDeps = {
  db: Database;
  monitorRuntime: MonitorRuntimeRepository;
  firings: MonitorFiringsProducer;
};

const RELAY_BATCH_LIMIT = 500;

async function relayOne(deps: MonitorRelayDeps, now: Date): Promise<boolean> {
  return deps.db.transaction(async (tx) => {
    const [event] = await deps.monitorRuntime.findUnrelayedEvents(1, tx);
    if (!event) return false;

    await deps.firings.enqueue({
      eventId: event.id,
      monitorId: event.monitorId,
      series: event.series,
      value: event.value,
      threshold: { operator: event.threshold.operator, value: event.threshold.value },
      occurredAt: event.occurredAt.toISOString(),
    });

    await deps.monitorRuntime.markRelayed([event.id], now, tx);
    return true;
  });
}

export async function relayMonitorFirings(
  deps: MonitorRelayDeps,
  now: Date,
): Promise<{ relayed: number }> {
  let relayed = 0;
  while (relayed < RELAY_BATCH_LIMIT) {
    const didRelay = await relayOne(deps, now);
    if (!didRelay) break;
    relayed += 1;
  }
  return { relayed };
}
