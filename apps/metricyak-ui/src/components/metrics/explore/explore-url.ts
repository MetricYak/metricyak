import type { TimeRange } from '@/api/events';
import {
  EXPLORE_TIME_RANGES,
  GRANULARITIES,
  type Granularity,
} from '@/components/metrics/explore/granularity';

export type ExploreFilter = { readonly name: string; readonly value: string };

export type ExploreSelection = { readonly from: string; readonly to: string };

export type ExploreState = {
  readonly metricId: string | null;
  readonly range: TimeRange;
  readonly granularity: Granularity | null;
  readonly splitBy: string | null;
  readonly filters: readonly ExploreFilter[];
  readonly compare: boolean;
  readonly selection: ExploreSelection | null;
};

export const DEFAULT_EXPLORE_RANGE: TimeRange = '24h';

const METRIC_KEY = 'm';
const RANGE_KEY = 'range';
const GRANULARITY_KEY = 'g';
const SPLIT_KEY = 'split';
const FILTER_KEY = 'f';
const COMPARE_KEY = 'compare';
const SELECTION_KEY = 'sel';
const SELECTION_SEPARATOR = '..';

function readRange(raw: string | null): TimeRange {
  const match = EXPLORE_TIME_RANGES.find((option) => option.id === raw);
  return match ? match.id : DEFAULT_EXPLORE_RANGE;
}

function readGranularity(raw: string | null): Granularity | null {
  return GRANULARITIES.find((granularity) => granularity === raw) ?? null;
}

export function parseFilter(entry: string): ExploreFilter | null {
  const separator = entry.indexOf(':');
  if (separator <= 0 || separator === entry.length - 1) return null;
  return { name: entry.slice(0, separator), value: entry.slice(separator + 1) };
}

export function formatFilter(filter: ExploreFilter): string {
  return `${filter.name}:${filter.value}`;
}

function readFilters(params: URLSearchParams): ExploreFilter[] {
  return params.getAll(FILTER_KEY).flatMap((entry) => {
    const filter = parseFilter(entry);
    return filter ? [filter] : [];
  });
}

function readSelection(raw: string | null): ExploreSelection | null {
  if (raw === null) return null;
  const separator = raw.indexOf(SELECTION_SEPARATOR);
  if (separator <= 0) return null;
  const from = raw.slice(0, separator);
  const to = raw.slice(separator + SELECTION_SEPARATOR.length);
  if (to === '') return null;
  return { from, to };
}

export function readExploreState(params: URLSearchParams): ExploreState {
  const compare = params.get(COMPARE_KEY) === '1';
  return {
    metricId: params.get(METRIC_KEY),
    range: readRange(params.get(RANGE_KEY)),
    granularity: readGranularity(params.get(GRANULARITY_KEY)),
    splitBy: compare ? null : params.get(SPLIT_KEY),
    filters: readFilters(params),
    compare,
    selection: readSelection(params.get(SELECTION_KEY)),
  };
}

export function writeExploreState(state: ExploreState): URLSearchParams {
  const params = new URLSearchParams();
  if (state.metricId) params.set(METRIC_KEY, state.metricId);
  params.set(RANGE_KEY, state.range);
  if (state.granularity) params.set(GRANULARITY_KEY, state.granularity);
  if (state.compare) params.set(COMPARE_KEY, '1');
  else if (state.splitBy) params.set(SPLIT_KEY, state.splitBy);
  for (const filter of state.filters) params.append(FILTER_KEY, formatFilter(filter));
  if (state.selection) {
    params.set(SELECTION_KEY, `${state.selection.from}${SELECTION_SEPARATOR}${state.selection.to}`);
  }
  return params;
}
