const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;
const FALLBACK_AFTER_MS = 30 * DAY_MS;

function pluralize(count: number, unit: string): string {
  return `${count} ${unit}${count === 1 ? '' : 's'} ago`;
}

function asDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function formatLastUsed(iso: string | null, now: Date): string {
  if (!iso) return 'Never used';

  const elapsed = now.getTime() - new Date(iso).getTime();
  if (elapsed >= FALLBACK_AFTER_MS) return `Last used ${asDate(iso)}`;
  if (elapsed < MINUTE_MS) return 'Last used just now';
  if (elapsed < HOUR_MS) return `Last used ${pluralize(Math.floor(elapsed / MINUTE_MS), 'minute')}`;
  if (elapsed < DAY_MS) return `Last used ${pluralize(Math.floor(elapsed / HOUR_MS), 'hour')}`;
  return `Last used ${pluralize(Math.floor(elapsed / DAY_MS), 'day')}`;
}

export function formatCountdown(iso: string, now: Date): string {
  const remaining = new Date(iso).getTime() - now.getTime();
  if (remaining <= 0) return 'expired';
  if (remaining < MINUTE_MS) return 'less than a minute';

  const hours = Math.floor(remaining / HOUR_MS);
  const minutes = Math.floor((remaining % HOUR_MS) / MINUTE_MS);
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
}
