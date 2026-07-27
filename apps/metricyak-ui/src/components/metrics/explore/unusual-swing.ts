import type { MetricPoint } from './explore-model';

const MIN_POINTS_FOR_BAND = 4;
const MAD_TO_DEVIATION = 1.4826;
const DEFAULT_TOLERANCE = 3;

export interface SwingBand {
  readonly median: number;
  readonly deviation: number;
}

function medianOf(values: readonly number[]): number {
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  const lower = sorted[middle - 1];
  const upper = sorted[middle];
  if (upper === undefined) return 0;
  return sorted.length % 2 === 0 && lower !== undefined ? (lower + upper) / 2 : upper;
}

export function swingBandOf(points: readonly MetricPoint[]): SwingBand | null {
  const recorded = points.flatMap((point) => (point.value === null ? [] : [point.value]));
  if (recorded.length < MIN_POINTS_FOR_BAND) return null;

  const median = medianOf(recorded);
  const deviation = medianOf(recorded.map((value) => Math.abs(value - median))) * MAD_TO_DEVIATION;
  return deviation > 0 ? { median, deviation } : null;
}

export function isUnusual(
  value: number | null,
  band: SwingBand | null,
  tolerance = DEFAULT_TOLERANCE,
): boolean {
  if (value === null || band === null) return false;
  return Math.abs(value - band.median) > band.deviation * tolerance;
}
