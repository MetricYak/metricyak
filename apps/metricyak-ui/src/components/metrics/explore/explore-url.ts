import { rangeCutoff, type TimeRange } from '@/api/events';
import {
  EXPLORE_TIME_RANGES,
  GRANULARITIES,
  type Granularity,
  MAX_SERVABLE_SPAN_MS,
} from '@/components/metrics/explore/granularity';

export type ExploreFilter = { readonly name: string; readonly value: string };

export type ExploreSelection = { readonly fromMs: number; readonly toMs: number };

export type ExploreWindow =
  | { readonly kind: 'preset'; readonly range: TimeRange }
  | { readonly kind: 'custom'; readonly fromMs: number; readonly toMs: number };

export const EXPLORE_TABS = ['breakdown', 'events'] as const;
export type ExploreTab = (typeof EXPLORE_TABS)[number];

export type ExploreState = {
  readonly metricId: string | null;
  readonly window: ExploreWindow;
  readonly granularity: Granularity | null;
  readonly filters: readonly ExploreFilter[];
  readonly selection: ExploreSelection | null;
  readonly tab: ExploreTab;
  readonly property: string | null;
};

export const DEFAULT_EXPLORE_RANGE: TimeRange = '7d';
export const DEFAULT_EXPLORE_WINDOW: ExploreWindow = {
  kind: 'preset',
  range: DEFAULT_EXPLORE_RANGE,
};

const METRIC_KEY = 'm';
const RANGE_KEY = 'range';
const FROM_KEY = 'from';
const TO_KEY = 'to';
const GRANULARITY_KEY = 'g';
const FILTER_KEY = 'f';
const SELECTION_KEY = 'sel';
const TAB_KEY = 'tab';
const PROPERTY_KEY = 'by';
const CUSTOM_RANGE = 'custom';
const SELECTION_SEPARATOR = '..';

function readEpochMs(raw: string | null): number | null {
  if (raw === null || raw.trim() === '') return null;
  const value = Number(raw);
  return Number.isSafeInteger(value) && value > 0 ? value : null;
}

function earliestServableStart(toMs: number): number {
  return toMs - MAX_SERVABLE_SPAN_MS;
}

function readWindow(params: URLSearchParams): ExploreWindow {
  const raw = params.get(RANGE_KEY);
  if (raw === CUSTOM_RANGE) {
    const fromMs = readEpochMs(params.get(FROM_KEY));
    const toMs = readEpochMs(params.get(TO_KEY));
    if (fromMs !== null && toMs !== null && toMs > fromMs) {
      return { kind: 'custom', fromMs: Math.max(fromMs, earliestServableStart(toMs)), toMs };
    }
    return DEFAULT_EXPLORE_WINDOW;
  }
  const match = EXPLORE_TIME_RANGES.find((option) => option.id === raw);
  return match ? { kind: 'preset', range: match.id } : DEFAULT_EXPLORE_WINDOW;
}

function readGranularity(raw: string | null): Granularity | null {
  return GRANULARITIES.find((granularity) => granularity === raw) ?? null;
}

function readTab(raw: string | null): ExploreTab {
  return EXPLORE_TABS.find((tab) => tab === raw) ?? 'breakdown';
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
  const fromMs = readEpochMs(raw.slice(0, separator));
  const toMs = readEpochMs(raw.slice(separator + SELECTION_SEPARATOR.length));
  return fromMs !== null && toMs !== null && toMs > fromMs ? { fromMs, toMs } : null;
}

export function readExploreState(params: URLSearchParams): ExploreState {
  return {
    metricId: params.get(METRIC_KEY),
    window: readWindow(params),
    granularity: readGranularity(params.get(GRANULARITY_KEY)),
    filters: readFilters(params),
    selection: readSelection(params.get(SELECTION_KEY)),
    tab: readTab(params.get(TAB_KEY)),
    property: params.get(PROPERTY_KEY),
  };
}

export function writeExploreState(state: ExploreState): URLSearchParams {
  const params = new URLSearchParams();
  if (state.metricId) params.set(METRIC_KEY, state.metricId);

  if (state.window.kind === 'custom') {
    params.set(RANGE_KEY, CUSTOM_RANGE);
    params.set(FROM_KEY, String(state.window.fromMs));
    params.set(TO_KEY, String(state.window.toMs));
  } else {
    params.set(RANGE_KEY, state.window.range);
  }

  if (state.granularity) params.set(GRANULARITY_KEY, state.granularity);
  for (const filter of state.filters) params.append(FILTER_KEY, formatFilter(filter));
  if (state.selection) {
    params.set(
      SELECTION_KEY,
      `${state.selection.fromMs}${SELECTION_SEPARATOR}${state.selection.toMs}`,
    );
  }
  if (state.tab !== 'breakdown') params.set(TAB_KEY, state.tab);
  if (state.property) params.set(PROPERTY_KEY, state.property);
  return params;
}

export function resolveWindow(window: ExploreWindow, nowMs: number): ExploreSelection {
  if (window.kind === 'custom') return { fromMs: window.fromMs, toMs: window.toMs };
  const cutoff = rangeCutoff(window.range, nowMs);
  return { fromMs: cutoff ?? nowMs, toMs: nowMs };
}

export function windowSpanMs(window: ExploreWindow, nowMs: number): number {
  const { fromMs, toMs } = resolveWindow(window, nowMs);
  return toMs - fromMs;
}
