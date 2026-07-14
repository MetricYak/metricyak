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

export const MONITOR_TICK_QUEUE = 'monitor-tick' as const;
export const MONITOR_TICK_INTERVAL_MS = 60_000;

export type MonitorTickJob = {
  tickAt: string;
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
