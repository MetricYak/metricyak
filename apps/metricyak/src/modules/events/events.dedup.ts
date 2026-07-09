import type { StoredEvent } from '@metricyak/queue';

export function dropDuplicateInsertIds(events: readonly StoredEvent[]): StoredEvent[] {
  const seenInsertIds = new Set<string>();
  const uniqueEvents: StoredEvent[] = [];

  for (const event of events) {
    if (event.insertId === null) {
      uniqueEvents.push(event);
      continue;
    }

    if (seenInsertIds.has(event.insertId)) {
      continue;
    }

    seenInsertIds.add(event.insertId);
    uniqueEvents.push(event);
  }

  return uniqueEvents;
}
