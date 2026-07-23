import type { MonitorDirtyBuffer, MonitorEvalProducer } from '@metricyak/queue';
import type { MonitorEventKeysRepository } from '@metricyak/storage';

export type MonitorDrainDeps = {
  dirty: MonitorDirtyBuffer;
  monitorEventKeys: MonitorEventKeysRepository;
  evalProducer: MonitorEvalProducer;
};

const DRAIN_BATCH = 1000;

export async function runMonitorDrain(
  deps: MonitorDrainDeps,
  now: Date,
): Promise<{ enqueued: number }> {
  const due = await deps.dirty.popDue(now, DRAIN_BATCH);
  if (due.length === 0) return { enqueued: 0 };

  const byProject = new Map<string, string[]>();
  for (const key of due) {
    const names = byProject.get(key.projectId) ?? [];
    names.push(key.eventName);
    byProject.set(key.projectId, names);
  }

  const monitorIds = new Set<string>();
  for (const [projectId, eventNames] of byProject) {
    const ids = await deps.monitorEventKeys.resolveEnabledMonitorIds(projectId, eventNames);
    for (const id of ids) monitorIds.add(id);
  }
  if (monitorIds.size === 0) return { enqueued: 0 };

  await deps.evalProducer.enqueueBulk(
    [...monitorIds].map((monitorId) => ({ monitorId, nextEvalAt: now })),
  );
  return { enqueued: monitorIds.size };
}
