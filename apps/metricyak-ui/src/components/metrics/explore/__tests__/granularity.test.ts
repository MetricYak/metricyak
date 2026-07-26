import { describe, expect, it } from 'vitest';
import {
  bucketCount,
  EXPLORE_TIME_RANGES,
  formatTick,
  granularityFor,
} from '@/components/metrics/explore/granularity';

describe('granularityFor', () => {
  it('maps each range to its default granularity at desktop width', () => {
    expect(granularityFor('15m', 900)).toBe('1m');
    expect(granularityFor('1h', 900)).toBe('1m');
    expect(granularityFor('6h', 900)).toBe('5m');
    expect(granularityFor('24h', 900)).toBe('15m');
    expect(granularityFor('7d', 900)).toBe('1h');
    expect(granularityFor('30d', 900)).toBe('4h');
    expect(granularityFor('month', 900)).toBe('1d');
  });

  it('coarsens when the viewport cannot give each bucket 4px', () => {
    expect(granularityFor('7d', 360)).not.toBe('1h');
  });

  it('never returns a granularity finer than the width allows', () => {
    const granularity = granularityFor('30d', 320);
    expect(['4h', '1d']).toContain(granularity);
  });
});

describe('bucketCount', () => {
  it('counts the buckets a range needs at a granularity', () => {
    const nowMs = new Date('2026-07-26T12:00:00.000Z').getTime();
    expect(bucketCount('24h', '1h', nowMs)).toBe(24);
    expect(bucketCount('7d', '4h', nowMs)).toBe(42);
  });
});

describe('EXPLORE_TIME_RANGES', () => {
  it('offers every range except all time', () => {
    expect(EXPLORE_TIME_RANGES.some((option) => option.id === 'all')).toBe(false);
    expect(EXPLORE_TIME_RANGES.some((option) => option.id === '24h')).toBe(true);
  });
});

describe('formatTick', () => {
  it('shows clock time below daily granularity', () => {
    expect(formatTick('2026-07-26T14:30:00.000Z', '1h')).toMatch(/^\d{1,2}[:.]\d{2}$/);
    expect(formatTick('2026-07-26T14:30:00.000Z', '1m')).toMatch(/^\d{1,2}[:.]\d{2}$/);
  });

  it('shows a calendar day at daily granularity', () => {
    const tick = formatTick('2026-07-26T14:30:00.000Z', '1d');
    expect(tick).not.toMatch(/^\d{1,2}[:.]\d{2}$/);
    expect(tick).toContain('26');
  });

  it('renders an unparseable instant as a dash', () => {
    expect(formatTick('not-a-date', '1h')).toBe('—');
  });
});
