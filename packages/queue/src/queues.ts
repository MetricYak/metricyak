import { createHash } from 'node:crypto';

export const EVENTS_QUEUE = 'events' as const;

export type StoredEvent = {
  id: string;
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
