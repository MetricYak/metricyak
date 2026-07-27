import { describe, expect, it } from 'vitest';
import type { MetricPoint } from '../explore-model';
import { isUnusual, swingBandOf } from '../unusual-swing';

function seriesOf(values: readonly (number | null)[]): MetricPoint[] {
  return values.map((value, index) => ({ startMs: index * 1000, value }));
}

describe('swingBandOf', () => {
  it('has no band when too few points were recorded', () => {
    expect(swingBandOf(seriesOf([10, 10, null]))).toBeNull();
  });

  it('has no band when every recorded point is identical', () => {
    expect(swingBandOf(seriesOf([10, 10, 10, 10, 10]))).toBeNull();
  });

  it('measures the median and a robust deviation, ignoring outliers', () => {
    const band = swingBandOf(seriesOf([10, 11, 9, 10, 11, 9, 10, 400]));
    expect(band).not.toBeNull();
    expect(band?.median).toBeCloseTo(10, 5);
    expect(band?.deviation).toBeGreaterThan(0);
    expect(band?.deviation).toBeLessThan(5);
  });

  it('averages the two middle values of an even-length series', () => {
    const band = swingBandOf(seriesOf([1, 2, 3, 4]));
    expect(band?.median).toBeCloseTo(2.5, 5);
  });

  it('takes the middle value of an odd-length series', () => {
    const band = swingBandOf(seriesOf([1, 2, 3, 4, 100]));
    expect(band?.median).toBeCloseTo(3, 5);
  });

  it('leaves the series it was given untouched', () => {
    const series = seriesOf([30, 10, 20, 40]);
    swingBandOf(series);
    expect(series.map((point) => point.value)).toEqual([30, 10, 20, 40]);
  });
});

describe('isUnusual', () => {
  const band = swingBandOf(seriesOf([10, 11, 9, 10, 11, 9, 10, 400]));

  it('flags a point far from the median in either direction', () => {
    expect(isUnusual(400, band)).toBe(true);
    expect(isUnusual(-380, band)).toBe(true);
  });

  it('leaves ordinary points and missing values alone', () => {
    expect(isUnusual(10, band)).toBe(false);
    expect(isUnusual(null, band)).toBe(false);
  });

  it('flags nothing without a band', () => {
    expect(isUnusual(400, null)).toBe(false);
  });

  it('widens and narrows with the tolerance it is given', () => {
    expect(isUnusual(16, band, 1)).toBe(true);
    expect(isUnusual(16, band, 10)).toBe(false);
  });

  it('flags nothing across a series of identical values', () => {
    const flatBand = swingBandOf(seriesOf([7, 7, 7, 7, 7, 7]));
    expect(isUnusual(7, flatBand)).toBe(false);
    expect(isUnusual(9000, flatBand)).toBe(false);
  });
});
