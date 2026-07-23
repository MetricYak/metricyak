import { and, asc, eq, exists, inArray, isNull, lte, or } from 'drizzle-orm';
import type { Database, Executor } from '@/client.js';
import { MONITOR_EVAL_FAILURE_THRESHOLD, monitorEvalBackoffMs } from '@/lib/monitor-health.js';
import type { MonitorRecord } from '@/repositories/monitors.repository.js';
import { type MonitorEventType, monitorEvents } from '@/schema/monitor-events.js';
import { type MonitorStatus, monitorState } from '@/schema/monitor-state.js';
import { type MonitorThresholdCondition, monitors } from '@/schema/monitors.js';
import { TOTAL_SENTINEL } from '@/schema/sentinels.js';

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

  async claimDueMonitors(now: Date, intervalMs: number, limit: number): Promise<MonitorRecord[]> {
    const nextEvalAt = new Date(now.getTime() + intervalMs);
    const timeSensitive = or(
      inArray(monitors.missingData, ['fire', 'zero']),
      exists(
        this.db
          .select()
          .from(monitorState)
          .where(
            and(
              eq(monitorState.monitorId, monitors.id),
              eq(monitorState.series, TOTAL_SENTINEL),
              inArray(monitorState.status, ['pending', 'firing']),
            ),
          ),
      ),
    );
    const due = this.db
      .select({ id: monitors.id })
      .from(monitors)
      .where(and(eq(monitors.enabled, true), lte(monitors.nextEvalAt, now), timeSensitive))
      .orderBy(asc(monitors.nextEvalAt))
      .limit(limit)
      .for('update', { skipLocked: true });

    return this.db
      .update(monitors)
      .set({ nextEvalAt })
      .where(inArray(monitors.id, due))
      .returning();
  }

  async lockMonitorForEval(monitorId: string, tx: Executor): Promise<MonitorRecord | null> {
    const [monitor] = await tx
      .select()
      .from(monitors)
      .where(and(eq(monitors.id, monitorId), eq(monitors.enabled, true)))
      .for('update')
      .limit(1);
    return monitor ?? null;
  }

  /**
   * Record a failed eval slot. Runs in its own transaction because the eval
   * transaction has already rolled back. If this write itself fails (e.g. a
   * global DB outage — the same failure that broke the eval), the counter does
   * not advance, so a global outage never produces a per-monitor incident.
   *
   * `now` is the failing eval's start time. Because recording happens
   * out-of-band, a newer slot can succeed (stamping `monitor_state.last_evaluated_at`
   * and resetting health) before this delayed recording obtains the row lock.
   * The freshness guard drops such stale failures: if a successful eval at or
   * after `now` already exists, this failure has been superseded and must not
   * be counted against the recovered monitor.
   */
  async recordEvalFailure(monitorId: string, error: string, now: Date): Promise<void> {
    await this.db.transaction(async (tx) => {
      const [row] = await tx
        .select({ consecutiveFailures: monitors.consecutiveFailures })
        .from(monitors)
        .where(eq(monitors.id, monitorId))
        .for('update')
        .limit(1);
      if (!row) return;

      const [state] = await tx
        .select({ lastEvaluatedAt: monitorState.lastEvaluatedAt })
        .from(monitorState)
        .where(and(eq(monitorState.monitorId, monitorId), eq(monitorState.series, TOTAL_SENTINEL)))
        .limit(1);
      // A newer (or concurrent) slot already succeeded — this failure is stale.
      if (state?.lastEvaluatedAt && state.lastEvaluatedAt >= now) return;

      const next = row.consecutiveFailures + 1;
      const set: {
        consecutiveFailures: number;
        lastEvalError: string;
        lastEvalErrorAt: Date;
        evalHealth?: 'error';
        nextEvalAt?: Date;
      } = {
        consecutiveFailures: next,
        lastEvalError: error.slice(0, 2000),
        lastEvalErrorAt: now,
      };
      if (next >= MONITOR_EVAL_FAILURE_THRESHOLD) {
        set.evalHealth = 'error';
        set.nextEvalAt = new Date(now.getTime() + monitorEvalBackoffMs(next));
      }
      await tx.update(monitors).set(set).where(eq(monitors.id, monitorId));
    });
  }

  /** Clear eval-failure health after a successful eval. */
  async resetEvalHealth(monitorId: string, executor: Executor = this.db): Promise<void> {
    await executor
      .update(monitors)
      .set({
        consecutiveFailures: 0,
        evalHealth: 'ok',
        lastEvalError: null,
        lastEvalErrorAt: null,
      })
      .where(eq(monitors.id, monitorId));
  }

  /** Last successful eval time per monitor (the `$total` series), for staleness. */
  async getLastEvaluatedAt(
    monitorIds: readonly string[],
    executor: Executor = this.db,
  ): Promise<Map<string, Date | null>> {
    if (monitorIds.length === 0) return new Map();
    const rows = await executor
      .select({
        monitorId: monitorState.monitorId,
        lastEvaluatedAt: monitorState.lastEvaluatedAt,
      })
      .from(monitorState)
      .where(
        and(
          inArray(monitorState.monitorId, [...monitorIds]),
          eq(monitorState.series, TOTAL_SENTINEL),
        ),
      );
    return new Map(rows.map((r) => [r.monitorId, r.lastEvaluatedAt]));
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
