import { describe, expect, it } from 'vitest';
import type { MetricPoint } from '@/components/metrics/explore/explore-model';
import { areaPath, linePath, recordedSegments } from '@/components/metrics/explore/series-path';

function pointsOf(values: readonly (number | null)[]): MetricPoint[] {
  return values.map((value, index) => ({ startMs: index * 1_000, value }));
}

describe('recordedSegments', () => {
  it('plots every recorded bucket as one unbroken segment', () => {
    const segments = recordedSegments(pointsOf([1, 2, 4, 3]), 4);

    expect(segments).toHaveLength(1);
    expect(segments[0]).toEqual([
      { index: 0, xPercent: 12.5, yPercent: 75 },
      { index: 1, xPercent: 37.5, yPercent: 50 },
      { index: 2, xPercent: 62.5, yPercent: 0 },
      { index: 3, xPercent: 87.5, yPercent: 25 },
    ]);
  });

  it('breaks the line where buckets recorded nothing', () => {
    const segments = recordedSegments(pointsOf([1, null, 2, 3]), 4);

    expect(segments.map((segment) => segment.map((plotted) => plotted.index))).toEqual([
      [0],
      [2, 3],
    ]);
  });

  it('has nothing to plot for an empty window', () => {
    expect(recordedSegments(pointsOf([null, null]), 4)).toEqual([]);
    expect(recordedSegments([], 4)).toEqual([]);
  });
});

describe('linePath', () => {
  it('moves to the first point and draws to the rest', () => {
    expect(linePath(recordedSegments(pointsOf([2, 4]), 4)[0] ?? [])).toBe(
      'M 25.00 50.00 L 75.00 0.00',
    );
  });
});

describe('areaPath', () => {
  it('closes the ridge down to the baseline', () => {
    expect(areaPath(recordedSegments(pointsOf([2, 4]), 4)[0] ?? [])).toBe(
      'M 25.00 100 L 25.00 50.00 L 75.00 0.00 L 75.00 100 Z',
    );
  });

  it('is empty when there is nothing to fill', () => {
    expect(areaPath([])).toBe('');
  });
});
