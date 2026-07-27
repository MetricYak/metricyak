import type { MetricKind } from './explore-model';
import { GRANULARITY_NOUN, type Granularity } from './granularity';
import { isAdditive } from './metric-shape';

export interface BaselineGuideRequest {
  readonly kind: MetricKind;
  readonly baseline: number | null;
  readonly windowSpanMs: number;
  readonly bucketMs: number;
}

export function baselineGuideValue({
  kind,
  baseline,
  windowSpanMs,
  bucketMs,
}: BaselineGuideRequest): number | null {
  if (baseline === null) return null;
  if (!isAdditive(kind)) return baseline;
  const bucketsInWindow = windowSpanMs / bucketMs;
  if (!Number.isFinite(bucketsInWindow) || bucketsInWindow <= 0) return null;
  return baseline / bucketsInWindow;
}

export function baselineGuideCaption(
  kind: MetricKind,
  metricName: string,
  granularity: Granularity,
): string {
  const subject = metricName.toLowerCase();
  return isAdditive(kind)
    ? `The dashed line is the prior window's average ${subject} per ${GRANULARITY_NOUN[granularity]}.`
    : `The dashed line is the prior window's ${subject}.`;
}
