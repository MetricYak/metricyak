const VALUE_FORMAT = new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 });
const DAY_TIME_FORMAT = new Intl.DateTimeFormat(undefined, {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});
const TIME_FORMAT = new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' });

export function formatMetricValue(value: number | null): string {
  return value === null ? '—' : VALUE_FORMAT.format(value);
}

export function formatDelta(current: number | null, previous: number | null): string | null {
  if (current === null || previous === null || previous === 0) return null;
  const change = ((current - previous) / Math.abs(previous)) * 100;
  const sign = change > 0 ? '+' : '';
  return `${sign}${VALUE_FORMAT.format(change)}%`;
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
