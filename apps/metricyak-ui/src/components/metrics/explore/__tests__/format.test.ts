import { describe, expect, it } from 'vitest';
import { formatEventCount } from '@/components/metrics/explore/format';

describe('formatEventCount', () => {
  it('states an exact total when the first page holds everything', () => {
    expect(formatEventCount({ page: 0, pageSize: 25, loadedCount: 12, hasMore: false })).toBe(
      '12 events',
    );
  });

  it('singularises a lone event', () => {
    expect(formatEventCount({ page: 0, pageSize: 25, loadedCount: 1, hasMore: false })).toBe(
      '1 event',
    );
  });

  it('falls back to a row range when more pages exist', () => {
    expect(formatEventCount({ page: 0, pageSize: 25, loadedCount: 25, hasMore: true })).toBe(
      'Events 1–25',
    );
  });

  it('offsets the row range by the page', () => {
    expect(formatEventCount({ page: 2, pageSize: 25, loadedCount: 10, hasMore: false })).toBe(
      'Events 51–60',
    );
  });

  it('says so when nothing loaded', () => {
    expect(formatEventCount({ page: 0, pageSize: 25, loadedCount: 0, hasMore: false })).toBe(
      'No events',
    );
  });
});
