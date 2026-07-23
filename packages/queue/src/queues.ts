import { createHash } from 'node:crypto';

export type StoredEvent = {
  id: string;
  insertId: string | null;
  name: string;
  timestamp: string;
  properties: Record<string, unknown>;
};

export type EventBatchJob = {
  projectId: string;
  batchId: string;
  events: StoredEvent[];
};

export function computeBatchId(eventIds: readonly string[]): string {
  return createHash('sha256')
    .update([...eventIds].sort().join(','))
    .digest('hex');
}

export const MONITOR_DISPATCH_QUEUE = 'monitor-dispatch' as const;
export const MONITOR_DISPATCH_INTERVAL_MS = 60_000;

export type MonitorDispatchJob = {
  tickAt: string;
};

export const MONITOR_EVAL_QUEUE = 'monitor-eval' as const;

export type MonitorEvalJob = {
  monitorId: string;
};

// One dispatch = one monitor claimed for a specific eval slot (its advanced next_eval_at).
export type MonitorEvalDispatch = {
  monitorId: string;
  nextEvalAt: Date;
};

// Slot-scoped BullMQ job id. A failed slot is retained under THIS id and can never
// dedup-block the next slot (a distinct id). At-most-once firing is enforced by the
// FOR UPDATE lock in runMonitorEval, not by this id.
export function monitorEvalJobId(monitorId: string, nextEvalAt: Date): string {
  return `${monitorId}:${nextEvalAt.getTime()}`;
}

export const MONITOR_SIGNALS_QUEUE = 'monitor-signals' as const;

export type MonitorSignalJob = {
  eventId: string;
  monitorId: string;
  series: string;
  value: number;
  threshold: { operator: string; value: number };
  occurredAt: string;
};

export const MONITOR_RELAY_QUEUE = 'monitor-relay' as const;
export const MONITOR_RELAY_INTERVAL_MS = 10_000;

export type MonitorRelayJob = {
  tickAt: string;
};

export const MONITOR_DEBOUNCE_MS = 5000;

export const MONITOR_DRAIN_QUEUE = 'monitor-drain' as const;
export const MONITOR_DRAIN_INTERVAL_MS = 2000;

export type MonitorDrainJob = {
  tickAt: string;
};

export const MONITOR_BACKSTOP_QUEUE = 'monitor-backstop' as const;
export const MONITOR_BACKSTOP_INTERVAL_MS = 1_800_000;

export type MonitorBackstopJob = {
  tickAt: string;
};
