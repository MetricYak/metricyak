import { describe, expect, it } from 'vitest';
import {
  axisTicks,
  axisTop,
  bucketCenterPercent,
  niceCeiling,
  valueHeightPercent,
} from '@/components/metrics/explore/chart-scale';

describe('niceCeiling', () => {
  it('rounds up to a readable step', () => {
    expect(niceCeiling(3.4)).toBe(4);
    expect(niceCeiling(1.8)).toBe(2);
    expect(niceCeiling(230)).toBe(250);
    expect(niceCeiling(0.031)).toBeCloseTo(0.04);
  });

  it('stays close above the value rather than jumping a whole step', () => {
    for (const value of [1.1, 2.7, 3.4, 5.6, 7.2, 9.4]) {
      expect(niceCeiling(value)).toBeLessThanOrEqual(value * 1.4);
    }
  });

  it('never returns zero for a degenerate maximum', () => {
    expect(niceCeiling(0)).toBe(1);
    expect(niceCeiling(-4)).toBe(1);
    expect(niceCeiling(Number.NaN)).toBe(1);
  });
});

describe('axisTop', () => {
  it('leaves headroom above the highest point', () => {
    expect(axisTop(3.4)).toBeGreaterThan(3.4);
  });

  it('handles an empty chart', () => {
    expect(axisTop(null)).toBe(1);
  });
});

describe('axisTicks', () => {
  it('spans zero to the top inclusive', () => {
    expect(axisTicks(4, 4)).toEqual([0, 1, 2, 3, 4]);
  });
});

describe('valueHeightPercent', () => {
  it('scales a value against the axis top', () => {
    expect(valueHeightPercent(2, 4)).toBe(50);
  });

  it('never overflows the plot or goes negative', () => {
    expect(valueHeightPercent(9, 4)).toBe(100);
    expect(valueHeightPercent(-2, 4)).toBe(0);
  });

  it('is flat when there is no value', () => {
    expect(valueHeightPercent(null, 4)).toBe(0);
    expect(valueHeightPercent(2, 0)).toBe(0);
  });
});

describe('bucketCenterPercent', () => {
  it('places each bucket at the middle of its slot', () => {
    expect(bucketCenterPercent(0, 4)).toBe(12.5);
    expect(bucketCenterPercent(3, 4)).toBe(87.5);
  });

  it('centres a chart with no buckets', () => {
    expect(bucketCenterPercent(0, 0)).toBe(50);
  });
});
