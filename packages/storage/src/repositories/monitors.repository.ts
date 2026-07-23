import { and, asc, eq, gt } from 'drizzle-orm';
import type { Database, Executor } from '@/client.js';
import {
  type MonitorEvalHealth,
  type MonitorMissingData,
  type MonitorScope,
  type MonitorThresholdCondition,
  monitors,
} from '@/schema/monitors.js';

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
