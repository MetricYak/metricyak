import { describe, expect, it } from 'vitest';
import { sliceHasMore } from '@/modules/events/events-reads.js';

describe('sliceHasMore', () => {
  it('reports hasMore when an extra row beyond pageSize was fetched', () => {
    const result = sliceHasMore([1, 2, 3], 2);
    expect(result.rows).toEqual([1, 2]);
    expect(result.hasMore).toBe(true);
  });

  it('reports no more when the row count is within pageSize', () => {
    const result = sliceHasMore([1, 2], 2);
    expect(result.rows).toEqual([1, 2]);
    expect(result.hasMore).toBe(false);
  });

  it('handles an empty result set', () => {
    const result = sliceHasMore([], 25);
    expect(result.rows).toEqual([]);
    expect(result.hasMore).toBe(false);
  });
});
