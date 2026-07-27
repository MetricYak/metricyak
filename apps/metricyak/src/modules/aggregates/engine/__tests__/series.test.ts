import type { MetricDefinition } from '@metricyak/storage';
import { OTHER_SENTINEL, TOTAL_SENTINEL } from '@metricyak/storage';
import { describe, expect, it } from 'vitest';
import { bucketStarts, buildSeries } from '@/modules/aggregates/engine/series.js';
import type { PartialRow } from '@/modules/aggregates/types.js';

const countDefinition: MetricDefinition = {
  events: [{ key: 'signups', source: 'events', type: 'signup', aggregation: 'count' }],
};

const averageDefinition: MetricDefinition = {
  events: [
    { key: 'latency', source: 'events', type: 'request', aggregation: 'average', field: 'ms' },
  ],
};

function partial(overrides: Partial<PartialRow>): PartialRow {
  return {
    bucketStart: new Date('2026-07-26T00:00:00.000Z'),
    seriesKey: 'signups',
    dimName: TOTAL_SENTINEL,
    dimValue: TOTAL_SENTINEL,
    count: 0,
    sum: 0,
    min: null,
    max: null,
    ...overrides,
  };
}

describe('bucketStarts', () => {
  it('covers the window on granularity boundaries, excluding `to`', () => {
    const starts = bucketStarts(
      new Date('2026-07-26T00:00:00.000Z'),
      new Date('2026-07-26T03:00:00.000Z'),
      '1h',
    );
    expect(starts.map((d) => d.toISOString())).toEqual([
      '2026-07-26T00:00:00.000Z',
      '2026-07-26T01:00:00.000Z',
      '2026-07-26T02:00:00.000Z',
    ]);
  });

  it('aligns the grid to the granularity boundary so it matches toStartOfInterval', () => {
    const starts = bucketStarts(
      new Date('2026-07-26T19:54:45.000Z'),
      new Date('2026-07-26T22:00:00.000Z'),
      '1h',
    );

    expect(starts.map((d) => d.toISOString())).toEqual([
      '2026-07-26T19:00:00.000Z',
      '2026-07-26T20:00:00.000Z',
      '2026-07-26T21:00:00.000Z',
    ]);
  });

  it('returns an empty grid when from is not before to', () => {
    const at = new Date('2026-07-26T00:00:00.000Z');
    expect(bucketStarts(at, at, '1h')).toEqual([]);
  });
});

describe('buildSeries', () => {
  it('reads partials landing on aligned buckets when the window starts mid-bucket', () => {
    const series = buildSeries({
      definition: countDefinition,
      partials: [partial({ bucketStart: new Date('2026-07-26T19:00:00.000Z'), count: 5 })],
      from: new Date('2026-07-26T19:54:45.000Z'),
      to: new Date('2026-07-26T21:00:00.000Z'),
      granularity: '1h',
      maxSeries: 6,
    });

    expect(series[0]?.points.map((p) => p.value)).toEqual([5, 0]);
  });

  it('emits one point per bucket, zero-filling gaps for a count metric', () => {
    const series = buildSeries({
      definition: countDefinition,
      partials: [partial({ bucketStart: new Date('2026-07-26T01:00:00.000Z'), count: 5 })],
      from: new Date('2026-07-26T00:00:00.000Z'),
      to: new Date('2026-07-26T03:00:00.000Z'),
      granularity: '1h',
      maxSeries: 6,
    });

    expect(series).toHaveLength(1);
    expect(series[0]?.dimValue).toBeNull();
    expect(series[0]?.points.map((p) => p.value)).toEqual([0, 5, 0]);
  });

  it('zero-fills an average metric with null, not zero', () => {
    const series = buildSeries({
      definition: averageDefinition,
      partials: [],
      from: new Date('2026-07-26T00:00:00.000Z'),
      to: new Date('2026-07-26T02:00:00.000Z'),
      granularity: '1h',
      maxSeries: 6,
    });

    expect(series[0]?.points.map((p) => p.value)).toEqual([null, null]);
  });

  it('splits into one series per dimension value', () => {
    const at = new Date('2026-07-26T00:00:00.000Z');
    const series = buildSeries({
      definition: countDefinition,
      partials: [
        partial({ bucketStart: at, dimName: 'plan', dimValue: 'pro', count: 3 }),
        partial({ bucketStart: at, dimName: 'plan', dimValue: 'free', count: 7 }),
      ],
      from: at,
      to: new Date('2026-07-26T01:00:00.000Z'),
      granularity: '1h',
      splitBy: 'plan',
      maxSeries: 6,
    });

    expect(series.map((s) => s.dimValue)).toEqual(['free', 'pro']);
    expect(series.map((s) => s.points[0]?.value)).toEqual([7, 3]);
  });

  it('folds everything past maxSeries into a single Other series', () => {
    const at = new Date('2026-07-26T00:00:00.000Z');
    const partials = ['a', 'b', 'c'].map((dimValue, index) =>
      partial({ bucketStart: at, dimName: 'plan', dimValue, count: 10 - index }),
    );

    const series = buildSeries({
      definition: countDefinition,
      partials,
      from: at,
      to: new Date('2026-07-26T01:00:00.000Z'),
      granularity: '1h',
      splitBy: 'plan',
      maxSeries: 2,
    });

    expect(series.map((s) => s.dimValue)).toEqual(['a', 'b', OTHER_SENTINEL]);
    expect(series[2]?.points[0]?.value).toBe(8);
  });
});
