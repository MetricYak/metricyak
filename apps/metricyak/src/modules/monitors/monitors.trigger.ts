import type { DirtyKey, MonitorDirtyBuffer } from '@metricyak/queue';

const KEY_SEPARATOR = String.fromCharCode(31);

export async function markBatchDirty(
  dirty: MonitorDirtyBuffer,
  events: readonly { projectId: string; name: string }[],
  now: Date,
): Promise<number> {
  const distinct = new Map<string, DirtyKey>();
  for (const event of events) {
    distinct.set(`${event.projectId}${KEY_SEPARATOR}${event.name}`, {
      projectId: event.projectId,
      eventName: event.name,
    });
  }
  const monitored = await dirty.filterMonitored([...distinct.values()]);
  await dirty.markDirty(monitored, now);
  return monitored.length;
}
