import type { ExploreSelection } from './explore-url';

export interface IndexRange {
  readonly start: number;
  readonly end: number;
}

export function bucketIndexAt(offsetX: number, plotWidth: number, bucketCount: number): number {
  if (bucketCount <= 0 || plotWidth <= 0) return 0;
  const index = Math.floor((offsetX / plotWidth) * bucketCount);
  return Math.min(bucketCount - 1, Math.max(0, index));
}

export function selectionFromIndices(
  bucketStarts: readonly number[],
  bucketMs: number,
  first: number,
  second: number,
): ExploreSelection | null {
  const low = Math.min(first, second);
  const high = Math.max(first, second);
  const fromMs = bucketStarts[low];
  const lastStartMs = bucketStarts[high];
  if (fromMs === undefined || lastStartMs === undefined) return null;
  return { fromMs, toMs: lastStartMs + bucketMs };
}

export function selectedIndexRange(
  bucketStarts: readonly number[],
  selection: ExploreSelection | null,
): IndexRange | null {
  if (!selection) return null;
  let start = -1;
  let end = -1;
  bucketStarts.forEach((startMs, index) => {
    if (startMs >= selection.fromMs && startMs < selection.toMs) {
      if (start === -1) start = index;
      end = index;
    }
  });
  return start === -1 ? null : { start, end };
}

export function isWithin(range: IndexRange | null, index: number): boolean {
  return range !== null && index >= range.start && index <= range.end;
}

export function fractionAcross(atMs: number, fromMs: number, toMs: number): number {
  if (toMs <= fromMs) return 0;
  return Math.min(1, Math.max(0, (atMs - fromMs) / (toMs - fromMs)));
}
