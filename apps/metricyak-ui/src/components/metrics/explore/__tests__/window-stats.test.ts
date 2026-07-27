import { describe, expect, it } from 'vitest';
import type { MetricPoint } from '../explore-model';
import { pointsWithin, windowStatsFor } from '../window-stats';

const points: MetricPoint[] = [
  { startMs: 0, value: 10 },
  { startMs: 100, value: 30 },
  { startMs: 200, value: null },
  { startMs: 300, value: 20 },
];

describe('pointsWithin', () => {
  it('keeps points whose start falls inside the half-open window', () => {
    expect(pointsWithin(points, 100, 300).map((point) => point.startMs)).toEqual([100, 200]);
  });
});

describe('windowStatsFor', () => {
  it('carries the exact current and prior values through', () => {
    const stats = windowStatsFor({ points, fromMs: 0, toMs: 400, current: 3.1, prior: 4.0 });
    expect(stats.value).toBe(3.1);
    expect(stats.baseline).toBe(4.0);
  });

  it('computes the change ratio against the magnitude of the prior value', () => {
    const stats = windowStatsFor({ points, fromMs: 0, toMs: 400, current: 3, prior: 4 });
    expect(stats.changeRatio).toBeCloseTo(-0.25);
  });

  it('has no change ratio when either side is missing or the prior is zero', () => {
    expect(
      windowStatsFor({ points, fromMs: 0, toMs: 400, current: 3, prior: null }).changeRatio,
    ).toBeNull();
    expect(
      windowStatsFor({ points, fromMs: 0, toMs: 400, current: null, prior: 4 }).changeRatio,
    ).toBeNull();
    expect(
      windowStatsFor({ points, fromMs: 0, toMs: 400, current: 3, prior: 0 }).changeRatio,
    ).toBeNull();
  });

  it('measures the change ratio against a negative prior without flipping its sign', () => {
    const stats = windowStatsFor({ points, fromMs: 0, toMs: 400, current: -3, prior: -4 });
    expect(stats.changeRatio).toBeCloseTo(0.25);
  });

  it('reports the peak and the count of recorded points in the window', () => {
    const stats = windowStatsFor({ points, fromMs: 0, toMs: 400, current: 3, prior: 4 });
    expect(stats.peak).toBe(30);
    expect(stats.pointCount).toBe(3);
  });

  it('has no peak when nothing was recorded', () => {
    const stats = windowStatsFor({ points: [], fromMs: 0, toMs: 400, current: null, prior: null });
    expect(stats.peak).toBeNull();
    expect(stats.pointCount).toBe(0);
  });

  it('ignores points outside the window when measuring the peak', () => {
    const stats = windowStatsFor({ points, fromMs: 100, toMs: 300, current: null, prior: null });
    expect(stats.peak).toBe(30);
    expect(stats.pointCount).toBe(1);
    expect(stats.fromMs).toBe(100);
    expect(stats.toMs).toBe(300);
  });
});
