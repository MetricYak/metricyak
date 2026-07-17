import { createHash } from 'node:crypto';

export const EVENTS_QUEUE = 'events' as const;

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
