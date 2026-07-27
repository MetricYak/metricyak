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
const MIN_READABLE_BARS = 2;
const COARSEST_GRANULARITY: Granularity = '1d';
const UNALIGNED_WINDOW_EXTRA_BUCKET = 1;

export const MAX_SERIES_BUCKETS = 200;
export const MAX_SERVABLE_SPAN_MS =
  (MAX_SERIES_BUCKETS - UNALIGNED_WINDOW_EXTRA_BUCKET) * GRANULARITY_MS[COARSEST_GRANULARITY];

export const EXPLORE_TIME_RANGES: readonly TimeRangeOption[] = TIME_RANGES.filter(
  (option) => option.id !== 'all',
);

function barCountFor(spanMs: number, granularity: Granularity): number {
  return Math.ceil(spanMs / GRANULARITY_MS[granularity]);
}

export function bucketCountFor(spanMs: number, granularity: Granularity): number {
  if (spanMs <= 0) return 0;
  return barCountFor(spanMs, granularity) + UNALIGNED_WINDOW_EXTRA_BUCKET;
}

function finestGranularityFor(spanMs: number): Granularity {
  const match = FINEST_GRANULARITY_BY_SPAN.find((entry) => spanMs <= entry.upToMs);
  return match ? match.finest : COARSEST_GRANULARITY;
}

function bucketsPerChartWidth(chartWidthPx: number): number {
  const width = chartWidthPx > 0 ? chartWidthPx : FALLBACK_CHART_WIDTH_PX;
  return Math.max(1, Math.floor(width / MIN_BUCKET_PX));
}

export function granularityChoicesFor(spanMs: number): Granularity[] {
  const servable = GRANULARITIES.filter(
    (granularity) => bucketCountFor(spanMs, granularity) <= MAX_SERIES_BUCKETS,
  );
  const readable = servable.filter(
    (granularity) => barCountFor(spanMs, granularity) >= MIN_READABLE_BARS,
  );
  if (readable.length > 0) return readable;
  if (servable.length > 0) return servable;
  return [COARSEST_GRANULARITY];
}

export function granularityForSpan(spanMs: number, chartWidthPx: number): Granularity {
  const choices = granularityChoicesFor(spanMs);
  const displayBudget = bucketsPerChartWidth(chartWidthPx);
  const finestIndexForSpan = GRANULARITIES.indexOf(finestGranularityFor(spanMs));

  const fitsChart = choices.filter(
    (granularity) =>
      GRANULARITIES.indexOf(granularity) >= finestIndexForSpan &&
      barCountFor(spanMs, granularity) <= displayBudget,
  );

  return fitsChart[0] ?? choices[choices.length - 1] ?? COARSEST_GRANULARITY;
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
