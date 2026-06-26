export const EVENTS_QUEUE = 'events' as const;

export type StoredEvent = {
  id: string;
  name: string;
  timestamp: string;
  properties: Record<string, unknown>;
};

export type EventBatchJob = {
  projectId: string;
  events: StoredEvent[];
};
