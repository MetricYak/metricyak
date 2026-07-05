import { fetchEventSource } from '@microsoft/fetch-event-source';
import { apiFetch } from '@/lib/api';

export type ActivityKind = 'event';

export type PropertyValue = unknown;

export interface ActivityEvent {
  id: string;
  kind: 'event';
  name: string;
  source: string | null;
  receivedAt: string;
  properties: Record<string, PropertyValue>;
}

export type PlatformActivity = ActivityEvent;

export type ActivityListener = (activity: PlatformActivity) => void;
export type Unsubscribe = () => void;

type EventRecord = {
  id: string;
  name: string;
  source: string | null;
  timestamp: string;
  properties: Record<string, unknown>;
};

type EventsListResponse = {
  events: EventRecord[];
  total: number;
};

function toActivity(record: EventRecord): ActivityEvent {
  return {
    id: record.id,
    kind: 'event',
    name: record.name,
    source: record.source,
    receivedAt: record.timestamp,
    properties: record.properties,
  };
}

export async function listRecentEvents(projectId: string, limit = 40): Promise<PlatformActivity[]> {
  const params = new URLSearchParams({ limit: String(limit), order: 'desc' });
  const result = await apiFetch<EventsListResponse>(
    `/v1/projects/${projectId}/events?${params.toString()}`,
  );
  return result.events.map(toActivity);
}

export type EventSort = 'time-desc' | 'time-asc';

export type TimeRange =
  | '15m'
  | '1h'
  | '3h'
  | '6h'
  | '12h'
  | '24h'
  | '3d'
  | '7d'
  | '14d'
  | '30d'
  | 'month'
  | 'all';

export interface TimeRangeOption {
  id: TimeRange;
  label: string;
}

export const TIME_RANGES: TimeRangeOption[] = [
  { id: '15m', label: 'Last 15 minutes' },
  { id: '1h', label: 'Last hour' },
  { id: '3h', label: 'Last 3 hours' },
  { id: '6h', label: 'Last 6 hours' },
  { id: '12h', label: 'Last 12 hours' },
  { id: '24h', label: 'Last 24 hours' },
  { id: '3d', label: 'Last 3 days' },
  { id: '7d', label: 'Last 7 days' },
  { id: '14d', label: 'Last 14 days' },
  { id: '30d', label: 'Last 30 days' },
  { id: 'month', label: 'This month' },
  { id: 'all', label: 'All time' },
];

const RANGE_DURATIONS: Partial<Record<TimeRange, number>> = {
  '15m': 15 * 60_000,
  '1h': 60 * 60_000,
  '3h': 3 * 60 * 60_000,
  '6h': 6 * 60 * 60_000,
  '12h': 12 * 60 * 60_000,
  '24h': 24 * 60 * 60_000,
  '3d': 3 * 24 * 60 * 60_000,
  '7d': 7 * 24 * 60 * 60_000,
  '14d': 14 * 24 * 60 * 60_000,
  '30d': 30 * 24 * 60 * 60_000,
};

export function rangeCutoff(range: TimeRange, nowMs: number): number | null {
  if (range === 'all') return null;
  if (range === 'month') {
    const d = new Date(nowMs);
    return new Date(d.getFullYear(), d.getMonth(), 1).getTime();
  }
  const duration = RANGE_DURATIONS[range];
  return duration ? nowMs - duration : null;
}

export function timeRangeLabel(range: TimeRange): string {
  return TIME_RANGES.find((r) => r.id === range)?.label ?? 'All time';
}

export interface EventQuery {
  range?: TimeRange;
  sort?: EventSort;
  page?: number;
  pageSize?: number;
}

export interface EventQueryResult {
  events: ActivityEvent[];
  total: number;
  page: number;
  pageSize: number;
}

export async function queryEvents(
  projectId: string,
  query: EventQuery = {},
): Promise<EventQueryResult> {
  const { range = 'all', sort = 'time-desc', page = 0, pageSize = 25 } = query;

  const params = new URLSearchParams({
    order: sort === 'time-asc' ? 'asc' : 'desc',
    limit: String(pageSize),
    offset: String(page * pageSize),
  });
  const cutoff = rangeCutoff(range, Date.now());
  if (cutoff != null) params.set('from', new Date(cutoff).toISOString());

  const result = await apiFetch<EventsListResponse>(
    `/v1/projects/${projectId}/events?${params.toString()}`,
  );

  return { events: result.events.map(toActivity), total: result.total, page, pageSize };
}

class RetriableError extends Error {}
class FatalError extends Error {}

export function subscribeToEvents(projectId: string, listener: ActivityListener): Unsubscribe {
  const ctrl = new AbortController();

  void fetchEventSource(`/stream/projects/${projectId}/events`, {
    signal: ctrl.signal,
    openWhenHidden: false,
    async onopen(response) {
      if (response.ok) return;
      if (response.status >= 400 && response.status < 500 && response.status !== 429) {
        throw new FatalError(`Livestream rejected the connection: ${response.status}`);
      }
      throw new RetriableError(`Livestream error: ${response.status}`);
    },
    onmessage(ev) {
      // The heartbeat is a distinct event type so it doesn't masquerade as a real event.
      if (ev.event && ev.event !== 'message') return;
      if (!ev.data) return;
      try {
        const record = JSON.parse(ev.data) as EventRecord;
        listener(toActivity(record));
      } catch {
        // Ignore malformed frames rather than tearing down the stream.
      }
    },
    onerror(err) {
      if (err instanceof FatalError) throw err;
      // Returning nothing (undefined) uses the library's default backoff.
    },
  }).catch(() => {
    // Aborted (unsubscribe called) or a FatalError was thrown — either way there's
    // nothing left to retry; `Unsubscribe` has no error channel to report through.
  });

  return () => ctrl.abort();
}
