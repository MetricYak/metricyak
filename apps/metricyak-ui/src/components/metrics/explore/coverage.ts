import type { MetricPoint } from './explore-model';
import { formatBucketMoment } from './granularity';

const IDLE_MARGIN_RATIO = 0.25;

export interface SeriesCoverage {
  readonly firstRecordedIndex: number;
  readonly lastRecordedIndex: number;
  readonly firstRecordedMs: number;
  readonly lastRecordedMs: number;
  readonly recordedCount: number;
}

export function seriesCoverage(points: readonly MetricPoint[]): SeriesCoverage | null {
  let first: { index: number; startMs: number } | null = null;
  let last: { index: number; startMs: number } | null = null;
  let recordedCount = 0;

  for (const [index, point] of points.entries()) {
    if (point.value === null) continue;
    recordedCount += 1;
    last = { index, startMs: point.startMs };
    first ??= last;
  }

  if (first === null || last === null) return null;

  return {
    firstRecordedIndex: first.index,
    lastRecordedIndex: last.index,
    firstRecordedMs: first.startMs,
    lastRecordedMs: last.startMs,
    recordedCount,
  };
}

export function idleBucketCount(coverage: SeriesCoverage, bucketCount: number): number {
  return coverage.firstRecordedIndex + Math.max(0, bucketCount - 1 - coverage.lastRecordedIndex);
}

export function hasIdleMargin(coverage: SeriesCoverage, bucketCount: number): boolean {
  if (bucketCount <= 0) return false;
  return idleBucketCount(coverage, bucketCount) / bucketCount > IDLE_MARGIN_RATIO;
}

export function coverageNote(coverage: SeriesCoverage, bucketCount: number): string {
  const emptyBefore = coverage.firstRecordedIndex > 0;
  const emptyAfter = coverage.lastRecordedIndex < bucketCount - 1;

  if (emptyBefore && emptyAfter) {
    return `Data runs ${formatBucketMoment(coverage.firstRecordedMs)} → ${formatBucketMoment(coverage.lastRecordedMs)}.`;
  }
  if (emptyBefore)
    return `Nothing recorded before ${formatBucketMoment(coverage.firstRecordedMs)}.`;
  return `Nothing recorded after ${formatBucketMoment(coverage.lastRecordedMs)}.`;
}
