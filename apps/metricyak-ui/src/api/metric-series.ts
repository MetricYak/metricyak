import type { RealEvent } from '@/api/events';
import type { Granularity } from '@/components/metrics/explore/granularity';
import { apiFetch } from '@/lib/api';

export type SeriesPoint = { start: string; value: number | null };
export type MetricSeries = { dimValue: string | null; points: SeriesPoint[] };
export type SeriesResponse = { granularity: Granularity; series: MetricSeries[] };

export type DimensionFilter = { name: string; value: string };

type DimensionBreakdown = {
  value: number | null;
  breakdown?: { dimValue: string; value: number | null }[];
};

function appendFilters(search: URLSearchParams, filters: readonly DimensionFilter[]): void {
  for (const filter of filters) search.append('filter', `${filter.name}:${filter.value}`);
}

export function getMetricSeries(
  projectId: string,
  metricId: string,
  params: {
    from: string;
    to: string;
    granularity: Granularity;
    splitBy?: string | null;
    filters: readonly DimensionFilter[];
  },
): Promise<SeriesResponse> {
  const search = new URLSearchParams({
    from: params.from,
    to: params.to,
    granularity: params.granularity,
  });
  if (params.splitBy) search.set('splitBy', params.splitBy);
  appendFilters(search, params.filters);
  return apiFetch<SeriesResponse>(
    `/v1/projects/${projectId}/metrics/${metricId}/series?${search.toString()}`,
  );
}

export function getMetricEvents(
  projectId: string,
  metricId: string,
  params: {
    from: string;
    to: string;
    filters: readonly DimensionFilter[];
    page: number;
    pageSize: number;
    sort: 'asc' | 'desc';
  },
): Promise<{ events: RealEvent[]; hasMore: boolean }> {
  const search = new URLSearchParams({
    from: params.from,
    to: params.to,
    page: String(params.page),
    pageSize: String(params.pageSize),
    sort: params.sort,
  });
  appendFilters(search, params.filters);
  return apiFetch<{ events: RealEvent[]; hasMore: boolean }>(
    `/v1/projects/${projectId}/metrics/${metricId}/events?${search.toString()}`,
  );
}

export async function getMetricDimensionValues(
  projectId: string,
  metricId: string,
  dimension: string,
  from: string,
  to: string,
): Promise<string[]> {
  const search = new URLSearchParams({ from, to, splitBy: dimension });
  const result = await apiFetch<DimensionBreakdown>(
    `/v1/projects/${projectId}/metrics/${metricId}/value?${search.toString()}`,
  );
  return (result.breakdown ?? []).map((entry) => entry.dimValue);
}
