import { describe, expect, it } from 'vitest';
import {
  coverageNote,
  hasIdleMargin,
  idleBucketCount,
  seriesCoverage,
} from '@/components/metrics/explore/coverage';
import type { MetricPoint } from '@/components/metrics/explore/explore-model';

const HOUR_MS = 60 * 60_000;

function pointsOf(values: readonly (number | null)[]): MetricPoint[] {
  return values.map((value, index) => ({ startMs: index * HOUR_MS, value }));
}

describe('seriesCoverage', () => {
  it('spans the first and last recorded bucket', () => {
    const coverage = seriesCoverage(pointsOf([null, 4, null, 7, null, null]));

    expect(coverage).toEqual({
      firstRecordedIndex: 1,
      lastRecordedIndex: 3,
      firstRecordedMs: HOUR_MS,
      lastRecordedMs: 3 * HOUR_MS,
      recordedCount: 2,
    });
  });

  it('counts a single recorded bucket as its own span', () => {
    const coverage = seriesCoverage(pointsOf([null, null, 9]));

    expect(coverage?.firstRecordedIndex).toBe(2);
    expect(coverage?.lastRecordedIndex).toBe(2);
    expect(coverage?.recordedCount).toBe(1);
  });

  it('has no coverage when nothing was recorded', () => {
    expect(seriesCoverage(pointsOf([null, null]))).toBeNull();
    expect(seriesCoverage([])).toBeNull();
  });

  it('treats zero as a recorded value, not a gap', () => {
    expect(seriesCoverage(pointsOf([0, 0]))?.recordedCount).toBe(2);
  });
});

describe('idleBucketCount', () => {
  it('counts the empty buckets at both edges, ignoring interior gaps', () => {
    const coverage = seriesCoverage(pointsOf([null, 4, null, 7, null, null]));
    if (!coverage) throw new Error('expected coverage');

    expect(idleBucketCount(coverage, 6)).toBe(3);
  });
});

describe('hasIdleMargin', () => {
  it('is true when the recorded data leaves a wide empty margin', () => {
    const coverage = seriesCoverage(pointsOf([...Array<null>(8).fill(null), 1, 2]));
    if (!coverage) throw new Error('expected coverage');

    expect(hasIdleMargin(coverage, 10)).toBe(true);
  });

  it('stays quiet when the window is nearly full', () => {
    const coverage = seriesCoverage(pointsOf([1, 2, 3, 4, 5, 6, 7, 8, 9, null]));
    if (!coverage) throw new Error('expected coverage');

    expect(hasIdleMargin(coverage, 10)).toBe(false);
  });

  it('stays quiet once a fit has left only a bucket-rounding margin', () => {
    const fitted = seriesCoverage(pointsOf([null, 1, 2, 3, 4, 5, 6, 7, 8, 9]));
    if (!fitted) throw new Error('expected coverage');

    expect(hasIdleMargin(fitted, 10)).toBe(false);
  });
});

describe('coverageNote', () => {
  it('names the start when only the lead-in is empty', () => {
    const coverage = seriesCoverage(pointsOf([null, null, 3, 4]));
    if (!coverage) throw new Error('expected coverage');

    expect(coverageNote(coverage, 4)).toMatch(/^Nothing recorded before /);
  });

  it('names the end when only the tail is empty', () => {
    const coverage = seriesCoverage(pointsOf([1, 2, null, null]));
    if (!coverage) throw new Error('expected coverage');

    expect(coverageNote(coverage, 4)).toMatch(/^Nothing recorded after /);
  });

  it('names both edges when the data sits in the middle', () => {
    const coverage = seriesCoverage(pointsOf([null, 2, 3, null]));
    if (!coverage) throw new Error('expected coverage');

    expect(coverageNote(coverage, 4)).toMatch(/^Data runs .+ → .+\.$/);
  });
});
