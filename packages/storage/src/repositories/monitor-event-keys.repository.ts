import { and, asc, eq, gt, inArray, or } from 'drizzle-orm';
import type { Database, Executor } from '@/client.js';
import { monitorEventKeys } from '@/schema/monitor-event-keys.js';
import { monitors } from '@/schema/monitors.js';

export class MonitorEventKeysRepository {
  constructor(private readonly db: Database) {}

  async sync(
    monitorId: string,
    projectId: string,
    eventNames: readonly string[],
    executor?: Executor,
  ): Promise<void> {
    const replaceRows = async (tx: Executor): Promise<void> => {
      await tx.delete(monitorEventKeys).where(eq(monitorEventKeys.monitorId, monitorId));
      const unique = [...new Set(eventNames)];
      if (unique.length === 0) return;
      await tx
        .insert(monitorEventKeys)
        .values(unique.map((eventName) => ({ monitorId, projectId, eventName })));
    };

    if (executor) {
      await replaceRows(executor);
    } else {
      await this.db.transaction((tx) => replaceRows(tx));
    }
  }

  async removeForMonitor(monitorId: string, executor: Executor = this.db): Promise<void> {
    await executor.delete(monitorEventKeys).where(eq(monitorEventKeys.monitorId, monitorId));
  }

  async resolveEnabledMonitorIds(
    projectId: string,
    eventNames: readonly string[],
  ): Promise<string[]> {
    if (eventNames.length === 0) return [];
    const rows = await this.db
      .selectDistinct({ monitorId: monitorEventKeys.monitorId })
      .from(monitorEventKeys)
      .innerJoin(monitors, eq(monitors.id, monitorEventKeys.monitorId))
      .where(
        and(
          eq(monitorEventKeys.projectId, projectId),
          inArray(monitorEventKeys.eventName, [...eventNames]),
          eq(monitors.enabled, true),
        ),
      );
    return rows.map((r) => r.monitorId);
  }

  async distinctKeysAfter(
    after: { projectId: string; eventName: string } | null,
    limit: number,
  ): Promise<{ projectId: string; eventName: string }[]> {
    const keyset = after
      ? or(
          gt(monitorEventKeys.projectId, after.projectId),
          and(
            eq(monitorEventKeys.projectId, after.projectId),
            gt(monitorEventKeys.eventName, after.eventName),
          ),
        )
      : undefined;
    return this.db
      .selectDistinct({
        projectId: monitorEventKeys.projectId,
        eventName: monitorEventKeys.eventName,
      })
      .from(monitorEventKeys)
      .where(keyset)
      .orderBy(asc(monitorEventKeys.projectId), asc(monitorEventKeys.eventName))
      .limit(limit);
  }
}
