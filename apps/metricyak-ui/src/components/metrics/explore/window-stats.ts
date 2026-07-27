import type { MetricPoint, WindowStats } from './explore-model';

export interface WindowStatsRequest {
  readonly points: readonly MetricPoint[];
  readonly fromMs: number;
  readonly toMs: number;
  readonly current: number | null;
  readonly prior: number | null;
}

export function pointsWithin(
  points: readonly MetricPoint[],
  fromMs: number,
  toMs: number,
): MetricPoint[] {
  return points.filter((point) => point.startMs >= fromMs && point.startMs < toMs);
}

function changeRatioOf(current: number | null, prior: number | null): number | null {
  if (current === null || prior === null || prior === 0) return null;
  return (current - prior) / Math.abs(prior);
}

export function windowStatsFor({
  points,
  fromMs,
  toMs,
  current,
  prior,
}: WindowStatsRequest): WindowStats {
  const recorded = pointsWithin(points, fromMs, toMs).flatMap((point) =>
    point.value === null ? [] : [point.value],
  );

  return {
    fromMs,
    toMs,
    value: current,
    baseline: prior,
    changeRatio: changeRatioOf(current, prior),
    peak: recorded.length > 0 ? Math.max(...recorded) : null,
    pointCount: recorded.length,
  };
}
