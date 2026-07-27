import type { ValueFormat } from './explore-model';

const MISSING = '—';
const MINUS = '−';
const FLAT_CHANGE_RATIO = 0.005;

const INTEGER = new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 });
const DECIMAL = new Intl.NumberFormat(undefined, {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const PERCENT = new Intl.NumberFormat(undefined, {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const POINT_CHANGE = new Intl.NumberFormat(undefined, {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const RATIO_CHANGE = new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 });

export type ChangeDirection = 'up' | 'down' | 'flat';

function isMissing(value: number | null): value is null {
  return value === null || !Number.isFinite(value);
}

export function formatMetricAmount(value: number | null, format: ValueFormat): string {
  if (isMissing(value)) return MISSING;
  switch (format) {
    case 'integer':
      return INTEGER.format(value);
    case 'decimal':
      return DECIMAL.format(value);
    case 'percent':
      return `${PERCENT.format(value * 100)}%`;
    default: {
      const _exhaustive: never = format;
      throw new Error(`Unhandled value format: ${JSON.stringify(_exhaustive)}`);
    }
  }
}

export function formatAbsoluteChange(change: number | null, format: ValueFormat): string {
  if (isMissing(change)) return MISSING;
  const sign = change >= 0 ? '+' : MINUS;
  const size = Math.abs(change);
  if (format === 'percent') return `${sign}${POINT_CHANGE.format(size * 100)} pp`;
  return `${sign}${formatMetricAmount(size, format)}`;
}

export function formatChangeRatio(ratio: number | null): string {
  if (isMissing(ratio)) return MISSING;
  const sign = ratio >= 0 ? '+' : MINUS;
  return `${sign}${RATIO_CHANGE.format(Math.abs(ratio) * 100)}%`;
}

export function formatCount(count: number): string {
  return INTEGER.format(count);
}

export function changeDirection(ratio: number | null): ChangeDirection {
  if (isMissing(ratio) || Math.abs(ratio) < FLAT_CHANGE_RATIO) return 'flat';
  return ratio > 0 ? 'up' : 'down';
}

export const CHANGE_DIRECTION_CLASS: Readonly<Record<ChangeDirection, string>> = {
  up: 'text-chart-1',
  down: 'text-chart-5',
  flat: 'text-muted-foreground',
};

export const CHANGE_DIRECTION_FILL: Readonly<Record<ChangeDirection, string>> = {
  up: 'var(--chart-1)',
  down: 'var(--chart-5)',
  flat: 'var(--metricyak-400)',
};
