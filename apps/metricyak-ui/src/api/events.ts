import { apiFetch } from '@/lib/api';

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

export interface RealEvent {
  id: string;
  name: string;
  timestamp: string;
  properties: Record<string, unknown>;
}

export interface ListEventsResult {
  events: RealEvent[];
  hasMore: boolean;
}

export const EVENT_PAGE_SIZES = [25, 50, 75, 100] as const;
export type EventPageSize = (typeof EVENT_PAGE_SIZES)[number];
const LARGEST_EVENT_PAGE: EventPageSize = 100;

export interface ListEventsInput {
  from?: string;
  to?: string;
  sort?: EventSort;
  page?: number;
  pageSize?: EventPageSize;
}

export function listEvents(
  projectId: string,
  input: ListEventsInput = {},
): Promise<ListEventsResult> {
  const searchParams = new URLSearchParams();
  if (input.from) searchParams.set('from', input.from);
  if (input.to) searchParams.set('to', input.to);
  if (input.sort) searchParams.set('sort', input.sort === 'time-asc' ? 'asc' : 'desc');
  if (input.page != null) searchParams.set('page', String(input.page));
  if (input.pageSize != null) searchParams.set('pageSize', String(input.pageSize));

  const qs = searchParams.toString();
  return apiFetch<ListEventsResult>(`/v1/projects/${projectId}/events${qs ? `?${qs}` : ''}`);
}

export async function listRecentEvents(projectId: string): Promise<RealEvent[]> {
  const { events } = await listEvents(projectId, {
    sort: 'time-desc',
    page: 0,
    pageSize: LARGEST_EVENT_PAGE,
  });
  return events;
}

export async function listRecentEventNames(projectId: string): Promise<string[]> {
  const events = await listRecentEvents(projectId);
  return [...new Set(events.map((event) => event.name))].sort((a, b) => a.localeCompare(b));
}
