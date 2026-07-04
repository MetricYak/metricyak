import { describe, expect, it } from 'vitest';
import { addGranularity, dayStart, floorToGranularity } from '../bucketing.js';

const at = (iso: string): Date => new Date(iso);

describe('floorToGranularity', () => {
  it('floors to the UTC minute', () => {
    expect(floorToGranularity(at('2025-01-15T12:34:56.789Z'), 'minute').toISOString()).toBe(
      '2025-01-15T12:34:00.000Z',
    );
  });

  it('floors to the UTC hour', () => {
    expect(floorToGranularity(at('2025-01-15T12:34:56.789Z'), 'hour').toISOString()).toBe(
      '2025-01-15T12:00:00.000Z',
    );
  });

  it('floors to UTC midnight', () => {
    expect(floorToGranularity(at('2025-01-15T12:34:56.789Z'), 'day').toISOString()).toBe(
      '2025-01-15T00:00:00.000Z',
    );
    expect(dayStart(at('2025-01-15T00:00:00.000Z')).toISOString()).toBe('2025-01-15T00:00:00.000Z');
  });
});

describe('addGranularity', () => {
  it('advances by whole buckets', () => {
    expect(addGranularity(at('2025-01-15T12:00:00.000Z'), 'hour', 2).toISOString()).toBe(
      '2025-01-15T14:00:00.000Z',
    );
  });
});
