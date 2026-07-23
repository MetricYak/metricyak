import { and, asc, desc, eq, getTableColumns, gt, ilike, isNull, or, type SQL } from 'drizzle-orm';
import type { Database, Executor } from '@/client.js';
import { monitorState } from '@/schema/monitor-state.js';
import {
  type MonitorEvalHealth,
  type MonitorMissingData,
  type MonitorScope,
  type MonitorThresholdCondition,
  monitors,
} from '@/schema/monitors.js';
import { TOTAL_SENTINEL } from '@/schema/sentinels.js';

export const MONITOR_STATUS_FILTERS = ['watching', 'pending', 'firing', 'error', 'paused'] as const;
export type MonitorStatusFilter = (typeof MONITOR_STATUS_FILTERS)[number];

export type ListMonitorsPageOptions = {
  page: number;
  pageSize: number;
  q?: string | null;
  status?: MonitorStatusFilter | null;
};

function statusFilterCondition(status: MonitorStatusFilter): SQL | undefined {
  switch (status) {
    case 'paused':
      return eq(monitors.enabled, false);
    case 'error':
      return and(eq(monitors.enabled, true), eq(monitors.evalHealth, 'error'));
    case 'firing':
      return and(
        eq(monitors.enabled, true),
        eq(monitors.evalHealth, 'ok'),
        eq(monitorState.status, 'firing'),
      );
    case 'pending':
      return and(
        eq(monitors.enabled, true),
        eq(monitors.evalHealth, 'ok'),
        eq(monitorState.status, 'pending'),
      );
    case 'watching':
      return and(
        eq(monitors.enabled, true),
        eq(monitors.evalHealth, 'ok'),
        or(isNull(monitorState.status), eq(monitorState.status, 'ok')),
      );
    default: {
      const _exhaustive: never = status;
      throw new Error(`Unhandled status filter: ${JSON.stringify(_exhaustive)}`);
    }
  }
}

export type CreateMonitorInput = {
  projectId: string;
  metricId: string;
  name: string;
  description?: string | null;
  scope?: MonitorScope | null;
  condition: MonitorThresholdCondition;
  window: string;
  holdFor: string;
  enabled?: boolean;
  missingData?: MonitorMissingData;
};

export type UpdateMonitorInput = {
  metricId?: string;
  name?: string;
  description?: string | null;
  scope?: MonitorScope | null;
  condition?: MonitorThresholdCondition;
  window?: string;
  holdFor?: string;
  enabled?: boolean;
  missingData?: MonitorMissingData;
};

export type MonitorRecord = {
  id: string;
  projectId: string;
  metricId: string;
  name: string;
  description: string | null;
  scope: MonitorScope | null;
  condition: MonitorThresholdCondition;
  window: string;
  holdFor: string;
  enabled: boolean;
  missingData: MonitorMissingData;
  consecutiveFailures: number;
  evalHealth: MonitorEvalHealth;
  lastEvalError: string | null;
  lastEvalErrorAt: Date | null;
  nextEvalAt: Date;
  createdAt: Date;
  updatedAt: Date;
};

export class MonitorsRepository {
  constructor(private readonly db: Database) {}

  async create(input: CreateMonitorInput, executor: Executor = this.db): Promise<MonitorRecord> {
    const [monitor] = await executor
      .insert(monitors)
      .values({
        projectId: input.projectId,
        metricId: input.metricId,
        name: input.name,
        description: input.description ?? null,
        scope: input.scope ?? null,
        condition: input.condition,
        window: input.window,
        holdFor: input.holdFor,
        enabled: input.enabled ?? true,
        missingData: input.missingData ?? 'skip',
      })
      .returning();

    if (!monitor) {
      throw new Error('Failed to insert monitor.');
    }

    return monitor;
  }

  async list(projectId: string): Promise<MonitorRecord[]> {
    return this.db.select().from(monitors).where(eq(monitors.projectId, projectId));
  }

  async get(id: string, projectId: string): Promise<MonitorRecord | null> {
    const [monitor] = await this.db
      .select()
      .from(monitors)
      .where(and(eq(monitors.id, id), eq(monitors.projectId, projectId)))
      .limit(1);

    return monitor ?? null;
  }

  async update(
    id: string,
    projectId: string,
    input: UpdateMonitorInput,
    executor: Executor = this.db,
  ): Promise<MonitorRecord | null> {
    const [monitor] = await executor
      .update(monitors)
      .set({
        ...(input.metricId !== undefined ? { metricId: input.metricId } : {}),
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.scope !== undefined ? { scope: input.scope } : {}),
        ...(input.condition !== undefined ? { condition: input.condition } : {}),
        ...(input.window !== undefined ? { window: input.window } : {}),
        ...(input.holdFor !== undefined ? { holdFor: input.holdFor } : {}),
        ...(input.enabled !== undefined ? { enabled: input.enabled } : {}),
        ...(input.missingData !== undefined ? { missingData: input.missingData } : {}),
      })
      .where(and(eq(monitors.id, id), eq(monitors.projectId, projectId)))
      .returning();

    return monitor ?? null;
  }

  async delete(id: string, projectId: string): Promise<boolean> {
    const deleted = await this.db
      .delete(monitors)
      .where(and(eq(monitors.id, id), eq(monitors.projectId, projectId)))
      .returning({ id: monitors.id });

    return deleted.length > 0;
  }

  async listPage(
    projectId: string,
    options: ListMonitorsPageOptions,
  ): Promise<{ monitors: MonitorRecord[]; hasMore: boolean }> {
    const { page, pageSize, q, status } = options;
    const conditions: (SQL | undefined)[] = [eq(monitors.projectId, projectId)];
    if (q) conditions.push(ilike(monitors.name, `%${q}%`));
    if (status) conditions.push(statusFilterCondition(status));

    const rows = await this.db
      .select(getTableColumns(monitors))
      .from(monitors)
      .leftJoin(
        monitorState,
        and(eq(monitorState.monitorId, monitors.id), eq(monitorState.series, TOTAL_SENTINEL)),
      )
      .where(and(...conditions))
      .orderBy(desc(monitors.createdAt), desc(monitors.id))
      .limit(pageSize + 1)
      .offset(page * pageSize);

    return { monitors: rows.slice(0, pageSize), hasMore: rows.length > pageSize };
  }

  async listEnabledIds(afterId: string | null, limit: number): Promise<{ id: string }[]> {
    return this.db
      .select({ id: monitors.id })
      .from(monitors)
      .where(
        afterId
          ? and(eq(monitors.enabled, true), gt(monitors.id, afterId))
          : eq(monitors.enabled, true),
      )
      .orderBy(asc(monitors.id))
      .limit(limit);
  }
}
