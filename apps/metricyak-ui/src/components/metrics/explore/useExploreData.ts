import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  getMetricSeries,
  getMetricValue,
  type MetricSeries,
  type ValueResponse,
} from '@/api/metric-series';
import { breakdownRows } from './breakdown';
import type {
  BreakdownRow,
  ExploreMetric,
  MetricPoint,
  WindowStats,
  WindowValues,
} from './explore-model';
import {
  type ExploreFilter,
  type ExploreSelection,
  formatFilter,
  parseFilter,
} from './explore-url';
import type { Granularity } from './granularity';
import { type SwingBand, swingBandOf } from './unusual-swing';
import { windowStatsFor } from './window-stats';

export interface ExploreDataInput {
  readonly projectId: string;
  readonly metric: ExploreMetric | null;
  readonly range: ExploreSelection;
  readonly analysis: ExploreSelection;
  readonly granularity: Granularity;
  readonly filters: readonly ExploreFilter[];
  readonly dimension: string | null;
}

export interface LoadedSeries {
  readonly points: readonly MetricPoint[];
  readonly granularity: Granularity;
}

export interface ExploreData {
  readonly series: LoadedSeries | null;
  readonly band: SwingBand | null;
  readonly stats: WindowStats | null;
  readonly breakdown: readonly BreakdownRow[];
  readonly loadingSeries: boolean;
  readonly loadingValues: boolean;
  readonly seriesFailed: boolean;
  readonly valuesFailed: boolean;
  readonly retry: () => void;
}

interface LoadedValues {
  readonly current: WindowValues;
  readonly prior: WindowValues;
}

const NO_ROWS: readonly BreakdownRow[] = [];
const FILTER_SEPARATOR = '\n';

function isoOf(atMs: number): string {
  return new Date(atMs).toISOString();
}

function pointsOf(series: readonly MetricSeries[]): MetricPoint[] {
  return (series[0]?.points ?? []).map((point) => ({
    startMs: Date.parse(point.start),
    value: point.value,
  }));
}

function valuesOf(response: ValueResponse): WindowValues {
  return { value: response.value, breakdown: response.breakdown ?? [] };
}

export function useExploreData({
  projectId,
  metric,
  range,
  analysis,
  granularity,
  filters,
  dimension,
}: ExploreDataInput): ExploreData {
  const [series, setSeries] = useState<LoadedSeries | null>(null);
  const [values, setValues] = useState<LoadedValues | null>(null);
  const [loadingSeries, setLoadingSeries] = useState(true);
  const [loadingValues, setLoadingValues] = useState(true);
  const [seriesFailed, setSeriesFailed] = useState(false);
  const [valuesFailed, setValuesFailed] = useState(false);

  const seriesRequest = useRef(0);
  const valuesRequest = useRef(0);

  const metricId = metric?.id ?? null;

  const subject = `${projectId}${FILTER_SEPARATOR}${metricId ?? ''}`;
  const [loadedSubject, setLoadedSubject] = useState(subject);
  if (subject !== loadedSubject) {
    setLoadedSubject(subject);
    setSeries(null);
    setValues(null);
    setSeriesFailed(false);
    setValuesFailed(false);
  }

  const filterKey = filters.map(formatFilter).join(FILTER_SEPARATOR);
  const apiFilters = useMemo(
    () =>
      filterKey === ''
        ? []
        : filterKey.split(FILTER_SEPARATOR).flatMap((entry) => {
            const filter = parseFilter(entry);
            return filter ? [{ name: filter.name, value: filter.value }] : [];
          }),
    [filterKey],
  );

  const loadSeries = useCallback((): void => {
    if (!metricId) {
      setLoadingSeries(false);
      return;
    }
    const id = ++seriesRequest.current;
    setLoadingSeries(true);
    getMetricSeries(projectId, metricId, {
      from: isoOf(range.fromMs),
      to: isoOf(range.toMs),
      granularity,
      filters: apiFilters,
    })
      .then((response) => {
        if (id !== seriesRequest.current) return;
        setSeries({ points: pointsOf(response.series), granularity: response.granularity });
        setSeriesFailed(false);
        setLoadingSeries(false);
      })
      .catch(() => {
        if (id !== seriesRequest.current) return;
        setSeriesFailed(true);
        setLoadingSeries(false);
      });
  }, [projectId, metricId, range.fromMs, range.toMs, granularity, apiFilters]);

  const loadValues = useCallback((): void => {
    if (!metricId) {
      setLoadingValues(false);
      return;
    }
    const id = ++valuesRequest.current;
    const spanMs = analysis.toMs - analysis.fromMs;
    setLoadingValues(true);
    Promise.all([
      getMetricValue(projectId, metricId, {
        from: isoOf(analysis.fromMs),
        to: isoOf(analysis.toMs),
        splitBy: dimension,
        filters: apiFilters,
      }),
      getMetricValue(projectId, metricId, {
        from: isoOf(analysis.fromMs - spanMs),
        to: isoOf(analysis.fromMs),
        splitBy: dimension,
        filters: apiFilters,
      }),
    ])
      .then(([currentResponse, priorResponse]) => {
        if (id !== valuesRequest.current) return;
        setValues({ current: valuesOf(currentResponse), prior: valuesOf(priorResponse) });
        setValuesFailed(false);
        setLoadingValues(false);
      })
      .catch(() => {
        if (id !== valuesRequest.current) return;
        setValuesFailed(true);
        setLoadingValues(false);
      });
  }, [projectId, metricId, analysis.fromMs, analysis.toMs, dimension, apiFilters]);

  useEffect(() => {
    loadSeries();
  }, [loadSeries]);

  useEffect(() => {
    loadValues();
  }, [loadValues]);

  const retry = useCallback((): void => {
    loadSeries();
    loadValues();
  }, [loadSeries, loadValues]);

  const stats = useMemo(
    () =>
      series === null
        ? null
        : windowStatsFor({
            points: series.points,
            fromMs: analysis.fromMs,
            toMs: analysis.toMs,
            current: values?.current.value ?? null,
            prior: values?.prior.value ?? null,
          }),
    [series, analysis.fromMs, analysis.toMs, values],
  );

  const breakdown = useMemo(
    () =>
      metric && dimension && values
        ? breakdownRows({
            kind: metric.kind,
            current: values.current.breakdown,
            prior: values.prior.breakdown,
          })
        : NO_ROWS,
    [metric, dimension, values],
  );

  const band = useMemo(() => (series === null ? null : swingBandOf(series.points)), [series]);

  return {
    series,
    band,
    stats,
    breakdown,
    loadingSeries,
    loadingValues,
    seriesFailed,
    valuesFailed,
    retry,
  };
}
