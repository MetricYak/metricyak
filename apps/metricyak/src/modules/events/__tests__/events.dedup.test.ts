import type { StoredEvent } from '@metricyak/queue';
import { describe, expect, it } from 'vitest';
import { dropDuplicateInsertIds } from '@/modules/events/events.dedup.js';

const event = (id: string, insertId: string | null): StoredEvent => ({
  id,
  insertId,
  name: 'purchase',
  timestamp: '2025-01-15T12:00:00.000Z',
  properties: {},
});

describe('dropDuplicateInsertIds', () => {
  it('keeps the first event for each repeated insert_id', () => {
    const result = dropDuplicateInsertIds([event('e1', 'a'), event('e2', 'a'), event('e3', 'b')]);

    expect(result.map((e) => e.id)).toEqual(['e1', 'e3']);
  });

  it('keeps every event that has no insert_id', () => {
    const result = dropDuplicateInsertIds([event('e1', null), event('e2', null)]);

    expect(result.map((e) => e.id)).toEqual(['e1', 'e2']);
  });

  it('deduplicates keyed events while keeping unkeyed ones', () => {
    const result = dropDuplicateInsertIds([
      event('e1', 'a'),
      event('e2', null),
      event('e3', 'a'),
      event('e4', null),
    ]);

    expect(result.map((e) => e.id)).toEqual(['e1', 'e2', 'e4']);
  });
});
