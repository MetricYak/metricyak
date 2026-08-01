import type { SignalSource, SignalSourceStatus } from '@/api/signal-sources';

export type SourceStatusTone = 'ok' | 'pending' | 'error';

export type SourceStatusView = {
  label: string;
  tone: SourceStatusTone;
};

export function deriveSourceStatus(status: SignalSourceStatus): SourceStatusView {
  switch (status) {
    case 'healthy':
      return { label: 'Receiving', tone: 'ok' };
    case 'awaiting_first_delivery':
      return { label: 'Waiting for first deploy', tone: 'pending' };
    case 'failing':
      return { label: 'Not working', tone: 'error' };
    default: {
      const _exhaustive: never = status;
      throw new Error(`Unhandled status: ${JSON.stringify(_exhaustive)}`);
    }
  }
}

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;
const FALLBACK_AFTER_MS = 30 * DAY_MS;

function pluralize(count: number, unit: string): string {
  return `${count} ${unit}${count === 1 ? '' : 's'} ago`;
}

export function formatLastDelivery(iso: string | null, now: Date): string {
  if (!iso) return 'Nothing yet';

  const elapsed = now.getTime() - new Date(iso).getTime();
  if (elapsed >= FALLBACK_AFTER_MS) {
    return new Date(iso).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  }
  if (elapsed < MINUTE_MS) return 'Just now';
  if (elapsed < HOUR_MS) return pluralize(Math.floor(elapsed / MINUTE_MS), 'minute');
  if (elapsed < DAY_MS) return pluralize(Math.floor(elapsed / HOUR_MS), 'hour');
  return pluralize(Math.floor(elapsed / DAY_MS), 'day');
}

export function matchesSourceQuery(source: SignalSource, query: string): boolean {
  const trimmed = query.trim().toLowerCase();
  if (trimmed === '') return true;
  return (
    source.name.toLowerCase().includes(trimmed) || source.provider.toLowerCase().includes(trimmed)
  );
}
