import { TIME_RANGES, type TimeRangeOption } from '@/api/events';

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

export const GRANULARITY_LABEL: Readonly<Record<Granularity, string>> = {
  '1m': 'Per minute',
  '5m': 'Per 5 minutes',
  '15m': 'Per 15 minutes',
  '1h': 'Hourly',
  '4h': 'Per 4 hours',
  '1d': 'Daily',
};

export const GRANULARITY_NOUN: Readonly<Record<Granularity, string>> = {
  '1m': 'minute',
  '5m': '5-minute',
  '15m': '15-minute',
  '1h': 'hour',
  '4h': '4-hour',
  '1d': 'day',
};

const HOUR_MS = GRANULARITY_MS['1h'];
const DAY_MS = GRANULARITY_MS['1d'];

const FINEST_GRANULARITY_BY_SPAN: readonly {
  readonly upToMs: number;
  readonly finest: Granularity;
}[] = [
  { upToMs: 2 * HOUR_MS, finest: '1m' },
  { upToMs: 8 * HOUR_MS, finest: '5m' },
  { upToMs: 36 * HOUR_MS, finest: '15m' },
  { upToMs: 10 * DAY_MS, finest: '1h' },
  { upToMs: 45 * DAY_MS, finest: '4h' },
];

const MIN_BUCKET_PX = 5;
const FALLBACK_CHART_WIDTH_PX = 900;

export const MAX_SERIES_BUCKETS = 200;

export const EXPLORE_TIME_RANGES: readonly TimeRangeOption[] = TIME_RANGES.filter(
  (option) => option.id !== 'all',
);

export function bucketCountFor(spanMs: number, granularity: Granularity): number {
  return Math.ceil(spanMs / GRANULARITY_MS[granularity]);
}

function finestGranularityFor(spanMs: number): Granularity {
  const match = FINEST_GRANULARITY_BY_SPAN.find((entry) => spanMs <= entry.upToMs);
  return match ? match.finest : '1d';
}

function bucketBudget(chartWidthPx: number): number {
  const width = chartWidthPx > 0 ? chartWidthPx : FALLBACK_CHART_WIDTH_PX;
  return Math.max(1, Math.min(MAX_SERIES_BUCKETS, Math.floor(width / MIN_BUCKET_PX)));
}

export function granularityForSpan(spanMs: number, chartWidthPx: number): Granularity {
  const maxBuckets = bucketBudget(chartWidthPx);
  const start = GRANULARITIES.indexOf(finestGranularityFor(spanMs));

  for (let index = start; index < GRANULARITIES.length; index += 1) {
    const candidate = GRANULARITIES[index];
    if (candidate && bucketCountFor(spanMs, candidate) <= maxBuckets) return candidate;
  }
  return '1d';
}

export function granularityChoicesFor(spanMs: number, chartWidthPx: number): Granularity[] {
  const maxBuckets = bucketBudget(chartWidthPx);
  return GRANULARITIES.filter((granularity) => {
    const count = bucketCountFor(spanMs, granularity);
    return count >= 2 && count <= maxBuckets;
  });
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

const DAY_CLOCK_FORMAT = new Intl.DateTimeFormat(undefined, {
  month: 'short',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

const MULTI_DAY_SPAN_MS = 2 * 24 * 60 * 60_000;
const DAY_ONLY_SPAN_MS = 6 * 24 * 60 * 60_000;

export function formatTick(atMs: number, granularity: Granularity, spanMs: number): string {
  if (!Number.isFinite(atMs)) return '—';
  if (granularity === '1d' || spanMs > DAY_ONLY_SPAN_MS) return DAY_TICK_FORMAT.format(atMs);
  if (spanMs > MULTI_DAY_SPAN_MS) return DAY_CLOCK_FORMAT.format(atMs);
  return CLOCK_TICK_FORMAT.format(atMs);
}

export function formatBucketMoment(atMs: number): string {
  return Number.isFinite(atMs) ? DAY_CLOCK_FORMAT.format(atMs) : '—';
}

export function formatDayLabel(atMs: number): string {
  return Number.isFinite(atMs) ? DAY_TICK_FORMAT.format(atMs) : '—';
}
