import { describe, expect, it } from 'vitest';
import {
  bucketIndexAt,
  fractionAcross,
  isWithin,
  selectedIndexRange,
  selectionFromIndices,
} from '@/components/metrics/explore/bucket-selection';

const HOUR_MS = 3_600_000;
const STARTS = [0, HOUR_MS, 2 * HOUR_MS, 3 * HOUR_MS];

describe('bucketIndexAt', () => {
  it('maps a pointer position to the bucket under it', () => {
    expect(bucketIndexAt(0, 400, 4)).toBe(0);
    expect(bucketIndexAt(150, 400, 4)).toBe(1);
    expect(bucketIndexAt(399, 400, 4)).toBe(3);
  });

  it('clamps a pointer that has left the plot', () => {
    expect(bucketIndexAt(-50, 400, 4)).toBe(0);
    expect(bucketIndexAt(9000, 400, 4)).toBe(3);
  });

  it('stays at zero when there is nothing to point at', () => {
    expect(bucketIndexAt(100, 400, 0)).toBe(0);
    expect(bucketIndexAt(100, 0, 4)).toBe(0);
  });
});

describe('selectionFromIndices', () => {
  it('covers the whole of the last bucket in the range', () => {
    expect(selectionFromIndices(STARTS, HOUR_MS, 1, 2)).toEqual({
      fromMs: HOUR_MS,
      toMs: 3 * HOUR_MS,
    });
  });

  it('reads the same range dragged in either direction', () => {
    expect(selectionFromIndices(STARTS, HOUR_MS, 2, 1)).toEqual(
      selectionFromIndices(STARTS, HOUR_MS, 1, 2),
    );
  });

  it('selects a single bucket as a full bucket span', () => {
    expect(selectionFromIndices(STARTS, HOUR_MS, 0, 0)).toEqual({ fromMs: 0, toMs: HOUR_MS });
  });

  it('has no selection when the indices are off the chart', () => {
    expect(selectionFromIndices(STARTS, HOUR_MS, 9, 12)).toBeNull();
    expect(selectionFromIndices([], HOUR_MS, 0, 0)).toBeNull();
  });
});

describe('selectedIndexRange', () => {
  it('finds the buckets a selection covers', () => {
    expect(selectedIndexRange(STARTS, { fromMs: HOUR_MS, toMs: 3 * HOUR_MS })).toEqual({
      start: 1,
      end: 2,
    });
  });

  it('has no range without a selection or when nothing overlaps', () => {
    expect(selectedIndexRange(STARTS, null)).toBeNull();
    expect(selectedIndexRange(STARTS, { fromMs: 90 * HOUR_MS, toMs: 91 * HOUR_MS })).toBeNull();
  });
});

describe('isWithin', () => {
  it('includes both ends of the range', () => {
    const range = { start: 1, end: 3 };
    expect(isWithin(range, 1)).toBe(true);
    expect(isWithin(range, 3)).toBe(true);
    expect(isWithin(range, 0)).toBe(false);
    expect(isWithin(null, 2)).toBe(false);
  });
});

describe('fractionAcross', () => {
  it('places a moment along the range', () => {
    expect(fractionAcross(50, 0, 100)).toBe(0.5);
  });

  it('clamps moments outside the range', () => {
    expect(fractionAcross(-10, 0, 100)).toBe(0);
    expect(fractionAcross(500, 0, 100)).toBe(1);
  });

  it('is zero for a range with no width', () => {
    expect(fractionAcross(5, 10, 10)).toBe(0);
  });
});
