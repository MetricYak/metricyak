const VALUE_FORMAT = new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 });
const DAY_TIME_FORMAT = new Intl.DateTimeFormat(undefined, {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});
const TIME_FORMAT = new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' });
const EVENT_MOMENT_FORMAT = new Intl.DateTimeFormat(undefined, {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
});

export function formatEventMoment(atMs: number): string {
  return Number.isFinite(atMs) ? EVENT_MOMENT_FORMAT.format(atMs) : '—';
}

export function formatMetricValue(value: number | null): string {
  return value === null ? '—' : VALUE_FORMAT.format(value);
}

export function formatDelta(current: number | null, previous: number | null): string | null {
  if (current === null || previous === null || previous === 0) return null;
  const change = ((current - previous) / Math.abs(previous)) * 100;
  const sign = change > 0 ? '+' : '';
  return `${sign}${VALUE_FORMAT.format(change)}%`;
}

const COUNT_FORMAT = new Intl.NumberFormat();

export interface EventPageBounds {
  readonly page: number;
  readonly pageSize: number;
  readonly loadedCount: number;
  readonly hasMore: boolean;
}

export function formatEventCount({
  page,
  pageSize,
  loadedCount,
  hasMore,
}: EventPageBounds): string {
  const firstRow = page * pageSize + 1;
  if (loadedCount === 0) return 'No events';
  if (page === 0 && !hasMore) {
    return loadedCount === 1 ? '1 event' : `${COUNT_FORMAT.format(loadedCount)} events`;
  }
  return `Events ${COUNT_FORMAT.format(firstRow)}–${COUNT_FORMAT.format(firstRow + loadedCount - 1)}`;
}

export function formatSpan(fromIso: string, toIso: string): string {
  const from = new Date(fromIso);
  const to = new Date(toIso);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return '—';

  const sameDay = from.toDateString() === to.toDateString();
  return sameDay
    ? `${DAY_TIME_FORMAT.format(from)} – ${TIME_FORMAT.format(to)}`
    : `${DAY_TIME_FORMAT.format(from)} – ${DAY_TIME_FORMAT.format(to)}`;
}
