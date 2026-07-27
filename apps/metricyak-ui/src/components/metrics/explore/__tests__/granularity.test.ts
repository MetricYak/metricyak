import { describe, expect, it } from 'vitest';
import {
  bucketCountFor,
  EXPLORE_TIME_RANGES,
  GRANULARITY_MS,
  granularityChoicesFor,
  granularityForSpan,
  MAX_SERIES_BUCKETS,
  MAX_SERVABLE_SPAN_MS,
} from '@/components/metrics/explore/granularity';

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;
const WIDE_CHART_PX = 900;
const CHART_WIDTHS_PX = [0, 240, 900, 2400];
const SERVABLE_SPANS_MS = [
  MINUTE_MS,
  15 * MINUTE_MS,
  6 * HOUR_MS,
  24 * HOUR_MS,
  7 * DAY_MS,
  30 * DAY_MS,
  120 * DAY_MS,
  MAX_SERVABLE_SPAN_MS - DAY_MS,
  MAX_SERVABLE_SPAN_MS,
];

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
  it('offers only bucket sizes that render more than one bar and that the API will serve', () => {
    const choices = granularityChoicesFor(7 * DAY_MS);
    expect(choices.length).toBeGreaterThan(0);
    for (const choice of choices) {
      const count = bucketCountFor(7 * DAY_MS, choice);
      expect(count).toBeGreaterThanOrEqual(2);
      expect(count).toBeLessThanOrEqual(MAX_SERIES_BUCKETS);
    }
  });

  it('always includes whatever the automatic pick would be', () => {
    const span = 30 * DAY_MS;
    expect(granularityChoicesFor(span)).toContain(granularityForSpan(span, WIDE_CHART_PX));
  });

  it('always includes the automatic pick at every span and chart width', () => {
    for (const spanMs of [...SERVABLE_SPANS_MS, 300 * DAY_MS, 30_000]) {
      for (const chartWidthPx of CHART_WIDTHS_PX) {
        expect(granularityChoicesFor(spanMs)).toContain(granularityForSpan(spanMs, chartWidthPx));
      }
    }
  });

  it('never comes back empty', () => {
    for (const spanMs of [...SERVABLE_SPANS_MS, 30_000, 300 * DAY_MS, 3 * 365 * DAY_MS]) {
      expect(granularityChoicesFor(spanMs).length).toBeGreaterThan(0);
    }
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
    for (const spanMs of SERVABLE_SPANS_MS) {
      for (const chartWidthPx of CHART_WIDTHS_PX) {
        const granularity = granularityForSpan(spanMs, chartWidthPx);
        expect(bucketCountFor(spanMs, granularity)).toBeLessThanOrEqual(MAX_SERIES_BUCKETS);
      }
    }
  });

  it('never offers a choice over the series bucket cap', () => {
    for (const spanMs of SERVABLE_SPANS_MS) {
      for (const granularity of granularityChoicesFor(spanMs)) {
        expect(bucketCountFor(spanMs, granularity)).toBeLessThanOrEqual(MAX_SERIES_BUCKETS);
      }
    }
  });

  it('holds at the widest span the API can serve', () => {
    expect(MAX_SERVABLE_SPAN_MS).toBe(MAX_SERIES_BUCKETS * GRANULARITY_MS['1d']);
    expect(
      bucketCountFor(MAX_SERVABLE_SPAN_MS, granularityForSpan(MAX_SERVABLE_SPAN_MS, 2400)),
    ).toBe(MAX_SERIES_BUCKETS);
  });

  it('falls back to the coarsest bucket for a span wider than the API can serve', () => {
    const spanMs = 300 * DAY_MS;
    expect(granularityForSpan(spanMs, 2400)).toBe('1d');
    expect(granularityChoicesFor(spanMs)).toEqual(['1d']);
  });
});
