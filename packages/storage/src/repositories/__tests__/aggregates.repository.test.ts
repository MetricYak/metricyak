import { describe, expect, it } from 'vitest';
import {
  type BucketPartialDelta,
  sortBucketDeltas,
  sortDimensionEntries,
} from '@/repositories/aggregates.repository.js';

function delta(overrides: Partial<BucketPartialDelta>): BucketPartialDelta {
  return {
    metricId: 'a',
    metricVersion: 1,
    granularity: 'minute',
    bucketStart: new Date('2026-01-01T00:00:00.000Z'),
    seriesKey: '$total',
    dimName: '$total',
    dimValue: '$total',
    count: 1,
    sum: 0,
    min: null,
    max: null,
    ...overrides,
  };
}

function bucketKey(d: BucketPartialDelta): string {
  return [
    d.metricId,
    d.metricVersion,
    d.granularity,
    d.bucketStart.getTime(),
    d.seriesKey,
    d.dimName,
    d.dimValue,
  ].join('|');
}

describe('sortBucketDeltas', () => {
  const deltas: BucketPartialDelta[] = [
    delta({ dimValue: 'us' }),
    delta({ dimValue: 'ca' }),
    delta({ granularity: 'hour' }),
    delta({ granularity: 'day' }),
    delta({ metricId: 'b' }),
    delta({ bucketStart: new Date('2026-01-01T00:01:00.000Z') }),
    delta({ seriesKey: 'clicks' }),
    delta({ metricVersion: 2 }),
    delta({ dimName: 'country' }),
  ];

  it('orders deltas by the full bucket primary key', () => {
    const sorted = sortBucketDeltas(deltas).map(bucketKey);
    const expected = [...sorted].sort();
    expect(sorted).toEqual(expected);
  });

  it('produces identical order regardless of input order (deadlock-safe)', () => {
    const forward = sortBucketDeltas(deltas).map(bucketKey);
    const reversed = sortBucketDeltas([...deltas].reverse()).map(bucketKey);
    expect(reversed).toEqual(forward);
  });

  it('does not mutate the input array', () => {
    const input = [...deltas];
    const snapshot = input.map(bucketKey);
    sortBucketDeltas(input);
    expect(input.map(bucketKey)).toEqual(snapshot);
  });
});

describe('sortDimensionEntries', () => {
  const entries = [
    { metricId: 'a', metricVersion: 1, dimName: 'country', dimValue: 'us' },
    { metricId: 'a', metricVersion: 1, dimName: 'country', dimValue: 'ca' },
    { metricId: 'a', metricVersion: 2, dimName: 'country', dimValue: 'ca' },
    { metricId: 'b', metricVersion: 1, dimName: 'plan', dimValue: 'pro' },
    { metricId: 'a', metricVersion: 1, dimName: 'plan', dimValue: 'free' },
  ];

  function dimKey(e: (typeof entries)[number]): string {
    return [e.metricId, e.metricVersion, e.dimName, e.dimValue].join('|');
  }

  it('orders entries by the full dimension primary key', () => {
    const sorted = sortDimensionEntries(entries).map(dimKey);
    expect(sorted).toEqual([...sorted].sort());
  });

  it('produces identical order regardless of input order (deadlock-safe)', () => {
    const forward = sortDimensionEntries(entries).map(dimKey);
    const reversed = sortDimensionEntries([...entries].reverse()).map(dimKey);
    expect(reversed).toEqual(forward);
  });
});
