import type { MonitorSignalsProducer } from '@metricyak/queue';
import type { MonitorRuntimeRepository } from '@metricyak/storage';

export type MonitorRelayDeps = {
  monitorRuntime: MonitorRuntimeRepository;
  signals: MonitorSignalsProducer;
};

const RELAY_BATCH_LIMIT = 500;

export async function relayMonitorSignals(
  deps: MonitorRelayDeps,
  now: Date,
): Promise<{ relayed: number }> {
  const events = await deps.monitorRuntime.findUnrelayedEvents(RELAY_BATCH_LIMIT);
  if (events.length === 0) return { relayed: 0 };

  for (const event of events) {
    await deps.signals.enqueue({
      eventId: event.id,
      monitorId: event.monitorId,
      series: event.series,
      value: event.value,
      threshold: { operator: event.threshold.operator, value: event.threshold.value },
      occurredAt: event.occurredAt.toISOString(),
    });
  }

  await deps.monitorRuntime.markRelayed(
    events.map((e) => e.id),
    now,
  );
  return { relayed: events.length };
}
