import type { MonitorDirtyBuffer, MonitorEvalProducer } from '@metricyak/queue';
import type { MonitorEventKeysRepository, MonitorsRepository } from '@metricyak/storage';

export type MonitorBackstopDeps = {
  monitors: MonitorsRepository;
  monitorEventKeys: MonitorEventKeysRepository;
  dirty: MonitorDirtyBuffer;
  evalProducer: MonitorEvalProducer;
};

const PAGE = 1000;
const MAX_PAGES = 2000;
const MEMBERSHIP_CHUNK = 5000;

export async function runMonitorBackstop(
  deps: MonitorBackstopDeps,
  now: Date,
): Promise<{ enqueued: number }> {
  let membershipAfter: { projectId: string; eventName: string } | null = null;
  for (let page = 0; page < MAX_PAGES; page++) {
    const keys = await deps.monitorEventKeys.distinctKeysAfter(membershipAfter, MEMBERSHIP_CHUNK);
    if (keys.length === 0) break;
    await deps.dirty.addMonitoredKeys(
      keys.map((k) => ({ projectId: k.projectId, eventName: k.eventName })),
    );
    const last = keys[keys.length - 1];
    membershipAfter = last ? { projectId: last.projectId, eventName: last.eventName } : null;
    if (keys.length < MEMBERSHIP_CHUNK) break;
  }

  let enqueued = 0;
  let afterId: string | null = null;
  for (let page = 0; page < MAX_PAGES; page++) {
    const ids = await deps.monitors.listEnabledIds(afterId, PAGE);
    if (ids.length === 0) break;
    await deps.evalProducer.enqueueBulk(ids.map((row) => ({ monitorId: row.id, nextEvalAt: now })));
    enqueued += ids.length;
    afterId = ids[ids.length - 1]?.id ?? null;
  }
  return { enqueued };
}
