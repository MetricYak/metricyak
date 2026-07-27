import { bucketCenterPercent, valueHeightPercent } from './chart-scale';
import type { MetricPoint } from './explore-model';

const PLOT_BOTTOM = 100;
const COORDINATE_PRECISION = 2;

export interface PlottedPoint {
  readonly index: number;
  readonly xPercent: number;
  readonly yPercent: number;
}

function coordinate(percent: number): string {
  return percent.toFixed(COORDINATE_PRECISION);
}

export function recordedSegments(points: readonly MetricPoint[], top: number): PlottedPoint[][] {
  const segments: PlottedPoint[][] = [];
  let running: PlottedPoint[] = [];

  points.forEach((point, index) => {
    if (point.value === null) {
      if (running.length > 0) segments.push(running);
      running = [];
      return;
    }
    running.push({
      index,
      xPercent: bucketCenterPercent(index, points.length),
      yPercent: PLOT_BOTTOM - valueHeightPercent(point.value, top),
    });
  });

  if (running.length > 0) segments.push(running);
  return segments;
}

export function linePath(segment: readonly PlottedPoint[]): string {
  return segment
    .map(
      (plotted, position) =>
        `${position === 0 ? 'M' : 'L'} ${coordinate(plotted.xPercent)} ${coordinate(plotted.yPercent)}`,
    )
    .join(' ');
}

export function areaPath(segment: readonly PlottedPoint[]): string {
  const first = segment[0];
  const last = segment[segment.length - 1];
  if (first === undefined || last === undefined) return '';

  const ridge = segment
    .map((plotted) => `L ${coordinate(plotted.xPercent)} ${coordinate(plotted.yPercent)}`)
    .join(' ');

  return [
    `M ${coordinate(first.xPercent)} ${PLOT_BOTTOM}`,
    ridge,
    `L ${coordinate(last.xPercent)} ${PLOT_BOTTOM}`,
    'Z',
  ].join(' ');
}
