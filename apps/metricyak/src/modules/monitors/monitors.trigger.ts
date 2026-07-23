import type { DirtyKey, MonitorDirtyBuffer } from '@metricyak/queue';

export async function markBatchDirty(
  dirty: MonitorDirtyBuffer,
  events: readonly { projectId: string; name: string }[],
  now: Date,
): Promise<number> {
  const distinct = new Map<string, DirtyKey>();
  for (const event of events) {
    distinct.set(`${event.projectId} ${event.name}`, {
      projectId: event.projectId,
      eventName: event.name,
    });
  }
  const monitored = await dirty.filterMonitored([...distinct.values()]);
  await dirty.markDirty(monitored, now);
  return monitored.length;
}
