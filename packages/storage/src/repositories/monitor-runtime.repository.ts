import { and, asc, eq, inArray, isNull, lte } from 'drizzle-orm';
import type { Database, Executor } from '@/client.js';
import type { MonitorRecord } from '@/repositories/monitors.repository.js';
import { type MonitorEventType, monitorEvents } from '@/schema/monitor-events.js';
import { type MonitorStatus, monitorState } from '@/schema/monitor-state.js';
import { type MonitorThresholdCondition, monitors } from '@/schema/monitors.js';

export type MonitorEvalStateRow = {
  monitorId: string;
  series: string;
  status: MonitorStatus;
  breachedSince: Date | null;
  lastValue: number | null;
  lastEvaluatedAt: Date | null;
};

export type UpsertStateInput = {
  monitorId: string;
  series: string;
  status: MonitorStatus;
  breachedSince: Date | null;
  lastValue: number | null;
  lastEvaluatedAt: Date;
};

export type InsertEventInput = {
  monitorId: string;
  series: string;
  type: MonitorEventType;
  value: number;
  threshold: MonitorThresholdCondition;
  occurredAt: Date;
};

export type MonitorEventRecord = {
  id: string;
  monitorId: string;
  series: string;
  type: MonitorEventType;
  value: number;
  threshold: MonitorThresholdCondition;
  occurredAt: Date;
};

export class MonitorRuntimeRepository {
  constructor(private readonly db: Database) {}

  async listDueMonitors(now: Date, limit: number): Promise<MonitorRecord[]> {
    return this.db
      .select()
      .from(monitors)
      .where(and(eq(monitors.enabled, true), lte(monitors.nextEvalAt, now)))
      .orderBy(asc(monitors.nextEvalAt))
      .limit(limit);
  }

  async lockDueMonitor(monitorId: string, now: Date, tx: Executor): Promise<MonitorRecord | null> {
    const [monitor] = await tx
      .select()
      .from(monitors)
      .where(
        and(eq(monitors.id, monitorId), eq(monitors.enabled, true), lte(monitors.nextEvalAt, now)),
      )
      .for('update', { skipLocked: true })
      .limit(1);
    return monitor ?? null;
  }

  async getState(
    monitorId: string,
    series: string,
    executor: Executor = this.db,
  ): Promise<MonitorEvalStateRow | null> {
    const [row] = await executor
      .select({
        monitorId: monitorState.monitorId,
        series: monitorState.series,
        status: monitorState.status,
        breachedSince: monitorState.breachedSince,
        lastValue: monitorState.lastValue,
        lastEvaluatedAt: monitorState.lastEvaluatedAt,
      })
      .from(monitorState)
      .where(and(eq(monitorState.monitorId, monitorId), eq(monitorState.series, series)))
      .limit(1);
    return row ?? null;
  }

  async upsertState(input: UpsertStateInput, executor: Executor = this.db): Promise<void> {
    await executor
      .insert(monitorState)
      .values({
        monitorId: input.monitorId,
        series: input.series,
        status: input.status,
        breachedSince: input.breachedSince,
        lastValue: input.lastValue,
        lastEvaluatedAt: input.lastEvaluatedAt,
      })
      .onConflictDoUpdate({
        target: [monitorState.monitorId, monitorState.series],
        set: {
          status: input.status,
          breachedSince: input.breachedSince,
          lastValue: input.lastValue,
          lastEvaluatedAt: input.lastEvaluatedAt,
        },
      });
  }

  async insertEvent(input: InsertEventInput, executor: Executor = this.db): Promise<string> {
    const [row] = await executor
      .insert(monitorEvents)
      .values({
        monitorId: input.monitorId,
        series: input.series,
        type: input.type,
        value: input.value,
        threshold: input.threshold,
        occurredAt: input.occurredAt,
      })
      .returning({ id: monitorEvents.id });
    if (!row) throw new Error('Failed to insert monitor event.');
    return row.id;
  }

  async setNextEvalAt(
    monitorId: string,
    nextEvalAt: Date,
    executor: Executor = this.db,
  ): Promise<void> {
    await executor.update(monitors).set({ nextEvalAt }).where(eq(monitors.id, monitorId));
  }

  async findUnrelayedEvents(
    limit: number,
    executor: Executor = this.db,
  ): Promise<MonitorEventRecord[]> {
    return executor
      .select({
        id: monitorEvents.id,
        monitorId: monitorEvents.monitorId,
        series: monitorEvents.series,
        type: monitorEvents.type,
        value: monitorEvents.value,
        threshold: monitorEvents.threshold,
        occurredAt: monitorEvents.occurredAt,
      })
      .from(monitorEvents)
      .where(isNull(monitorEvents.relayedAt))
      .orderBy(asc(monitorEvents.occurredAt))
      .for('update', { skipLocked: true })
      .limit(limit);
  }

  async markRelayed(
    ids: readonly string[],
    relayedAt: Date,
    executor: Executor = this.db,
  ): Promise<void> {
    if (ids.length === 0) return;
    await executor
      .update(monitorEvents)
      .set({ relayedAt })
      .where(inArray(monitorEvents.id, [...ids]));
  }
}
