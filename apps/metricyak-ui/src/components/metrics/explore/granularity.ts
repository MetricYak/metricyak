import { rangeCutoff, TIME_RANGES, type TimeRange, type TimeRangeOption } from '@/api/events';

export const GRANULARITIES = ['1m', '5m', '15m', '1h', '4h', '1d'] as const;

export type Granularity = (typeof GRANULARITIES)[number];

export const GRANULARITY_MS: Readonly<Record<Granularity, number>> = {
  '1m': 60_000,
  '5m': 5 * 60_000,
  '15m': 15 * 60_000,
  '1h': 60 * 60_000,
  '4h': 4 * 60 * 60_000,
  '1d': 24 * 60 * 60_000,
};

const DEFAULT_GRANULARITY: Readonly<Record<TimeRange, Granularity>> = {
  '15m': '1m',
  '1h': '1m',
  '3h': '5m',
  '6h': '5m',
  '12h': '5m',
  '24h': '15m',
  '3d': '1h',
  '7d': '1h',
  '14d': '4h',
  '30d': '4h',
  month: '1d',
  all: '1d',
};

const MIN_BUCKET_PX = 4;

export const EXPLORE_TIME_RANGES: TimeRangeOption[] = TIME_RANGES.filter(
  (option) => option.id !== 'all',
);

export function rangeDurationMs(range: TimeRange, nowMs: number): number {
  const cutoff = rangeCutoff(range, nowMs);
  return cutoff === null ? GRANULARITY_MS['1d'] : nowMs - cutoff;
}

export function bucketCount(range: TimeRange, granularity: Granularity, nowMs: number): number {
  return Math.ceil(rangeDurationMs(range, nowMs) / GRANULARITY_MS[granularity]);
}

export function granularityFor(range: TimeRange, chartWidthPx: number): Granularity {
  const nowMs = Date.now();
  const finest = GRANULARITIES.indexOf(DEFAULT_GRANULARITY[range]);
  const maxBuckets = Math.max(1, Math.floor(chartWidthPx / MIN_BUCKET_PX));

  for (let index = finest; index < GRANULARITIES.length; index += 1) {
    const candidate = GRANULARITIES[index];
    if (candidate && bucketCount(range, candidate, nowMs) <= maxBuckets) return candidate;
  }
  return '1d';
}

const CLOCK_TICK_FORMAT = new Intl.DateTimeFormat(undefined, {
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

const DAY_TICK_FORMAT = new Intl.DateTimeFormat(undefined, {
  month: 'short',
  day: 'numeric',
});

export function formatTick(value: string, granularity: Granularity): string {
  const at = new Date(value);
  if (Number.isNaN(at.getTime())) return '—';
  return granularity === '1d' ? DAY_TICK_FORMAT.format(at) : CLOCK_TICK_FORMAT.format(at);
}
