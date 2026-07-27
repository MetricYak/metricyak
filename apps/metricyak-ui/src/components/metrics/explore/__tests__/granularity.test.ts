import { describe, expect, it } from 'vitest';
import {
  bucketCountFor,
  EXPLORE_TIME_RANGES,
  GRANULARITY_MS,
  granularityChoicesFor,
  granularityForSpan,
  MAX_SERIES_BUCKETS,
} from '@/components/metrics/explore/granularity';

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;
const WIDE_CHART_PX = 900;

describe('granularityForSpan', () => {
  it('picks a bucket size that suits the span', () => {
    expect(granularityForSpan(15 * MINUTE_MS, WIDE_CHART_PX)).toBe('1m');
    expect(granularityForSpan(6 * HOUR_MS, WIDE_CHART_PX)).toBe('5m');
    expect(granularityForSpan(24 * HOUR_MS, WIDE_CHART_PX)).toBe('15m');
    expect(granularityForSpan(7 * DAY_MS, WIDE_CHART_PX)).toBe('1h');
    expect(granularityForSpan(30 * DAY_MS, WIDE_CHART_PX)).toBe('4h');
    expect(granularityForSpan(180 * DAY_MS, WIDE_CHART_PX)).toBe('1d');
  });

  it('widens buckets rather than crushing them on a narrow chart', () => {
    expect(granularityForSpan(7 * DAY_MS, 240)).not.toBe('1h');
  });

  it('keeps every bucket at least a few pixels wide', () => {
    const narrow = 320;
    const granularity = granularityForSpan(30 * DAY_MS, narrow);
    expect(bucketCountFor(30 * DAY_MS, granularity)).toBeLessThanOrEqual(narrow / 5);
  });

  it('falls back to a sane width when the chart has not been measured', () => {
    expect(granularityForSpan(7 * DAY_MS, 0)).toBe('1h');
  });
});

describe('granularityChoicesFor', () => {
  it('offers only bucket sizes that render more than one bar and still fit', () => {
    const choices = granularityChoicesFor(7 * DAY_MS, WIDE_CHART_PX);
    expect(choices.length).toBeGreaterThan(0);
    for (const choice of choices) {
      const count = bucketCountFor(7 * DAY_MS, choice);
      expect(count).toBeGreaterThanOrEqual(2);
      expect(count).toBeLessThanOrEqual(WIDE_CHART_PX / 5);
    }
  });

  it('always includes whatever the automatic pick would be', () => {
    const span = 30 * DAY_MS;
    expect(granularityChoicesFor(span, WIDE_CHART_PX)).toContain(
      granularityForSpan(span, WIDE_CHART_PX),
    );
  });
});

describe('bucketCountFor', () => {
  it('counts whole buckets across the span', () => {
    expect(bucketCountFor(DAY_MS, '1h')).toBe(24);
    expect(bucketCountFor(DAY_MS, '1d')).toBe(1);
  });
});

describe('EXPLORE_TIME_RANGES', () => {
  it('leaves out all time, which has no bounded span to chart', () => {
    expect(EXPLORE_TIME_RANGES.some((option) => option.id === 'all')).toBe(false);
    expect(EXPLORE_TIME_RANGES.some((option) => option.id === '7d')).toBe(true);
  });
});

describe('GRANULARITY_MS', () => {
  it('is ordered from finest to coarsest', () => {
    expect(GRANULARITY_MS['1m']).toBeLessThan(GRANULARITY_MS['1h']);
    expect(GRANULARITY_MS['4h']).toBeLessThan(GRANULARITY_MS['1d']);
  });
});

describe('series bucket cap', () => {
  it('never chooses a granularity over the series bucket cap', () => {
    const spanMs = 24 * 60 * 60_000;
    const granularity = granularityForSpan(spanMs, 2400);
    expect(bucketCountFor(spanMs, granularity)).toBeLessThanOrEqual(MAX_SERIES_BUCKETS);
  });

  it('never offers a choice over the series bucket cap', () => {
    const spanMs = 24 * 60 * 60_000;
    for (const granularity of granularityChoicesFor(spanMs, 2400)) {
      expect(bucketCountFor(spanMs, granularity)).toBeLessThanOrEqual(MAX_SERIES_BUCKETS);
    }
  });
});
