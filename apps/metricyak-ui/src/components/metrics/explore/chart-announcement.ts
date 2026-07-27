import { type BucketCursor, cursorBounds } from './chart-keyboard-selection';
import type { MetricPoint, ValueFormat } from './explore-model';
import { formatBucketMoment, GRANULARITY_NOUN, type Granularity } from './granularity';
import { formatMetricAmount } from './value-format';

function bucketQuantity(bucketCount: number, granularity: Granularity): string {
  const noun = GRANULARITY_NOUN[granularity];
  return `${bucketCount} ${noun}${bucketCount === 1 ? '' : 's'}`;
}

function spanPhrase(
  points: readonly MetricPoint[],
  bounds: { start: number; end: number },
  granularity: Granularity,
): string | null {
  const start = points[bounds.start];
  const end = points[bounds.end];
  if (start === undefined || end === undefined) return null;
  const bucketCount = bounds.end - bounds.start + 1;
  return `${formatBucketMoment(start.startMs)} to ${formatBucketMoment(end.startMs)}, ${bucketQuantity(bucketCount, granularity)}`;
}

export function cursorAnnouncement(
  points: readonly MetricPoint[],
  cursor: BucketCursor,
  granularity: Granularity,
  valueFormat: ValueFormat,
): string {
  const bounds = cursorBounds(cursor);

  if (bounds.start === bounds.end) {
    const focused = points[bounds.start];
    if (focused === undefined) return '';
    return `${formatBucketMoment(focused.startMs)}, ${formatMetricAmount(focused.value, valueFormat)}`;
  }

  const span = spanPhrase(points, bounds, granularity);
  return span === null ? '' : `Selecting ${span}`;
}

export function commitAnnouncement(
  points: readonly MetricPoint[],
  bounds: { start: number; end: number },
  granularity: Granularity,
): string {
  const span = spanPhrase(points, bounds, granularity);
  return span === null ? '' : `Selected ${span}`;
}
