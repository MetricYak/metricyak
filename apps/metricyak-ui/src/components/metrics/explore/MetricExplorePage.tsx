import { LineChart, Plus, RefreshCw, RotateCcw, X, ZoomIn } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { getMetricDimensionValues } from '@/api/metric-series';
import { listMetrics, type Metric } from '@/api/metrics';
import { PageContainer } from '@/components/shell/PageContainer';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Surface } from '@/components/ui/surface';
import { useProjectRoute } from '@/hooks/useProjectRoute';
import { baselineGuideCaption, baselineGuideValue } from './baseline-guide';
import { coverageNote, hasIdleMargin, seriesCoverage } from './coverage';
import { ExploreTabs } from './ExploreTabs';
import { ExploreToolbar } from './ExploreToolbar';
import {
  type ExploreFilter,
  type ExploreState,
  readExploreState,
  resolveWindow,
  writeExploreState,
} from './explore-url';
import {
  formatBucketMoment,
  GRANULARITY_MS,
  granularityChoicesFor,
  granularityForSpan,
} from './granularity';
import { MetricChart } from './MetricChart';
import { MetricEventsPanel } from './MetricEventsPanel';
import { MetricSummaryTiles } from './MetricSummaryTiles';
import { isAdditive, toExploreMetric } from './metric-shape';
import { PropertyBreakdown } from './PropertyBreakdown';
import { summaryTilesFor } from './summary-tiles';
import { useExploreData } from './useExploreData';
import { CHANGE_DIRECTION_CLASS, changeDirection, formatChangeRatio } from './value-format';

const DEFAULT_PLOT_WIDTH_PX = 900;
const NO_DIMENSIONS: readonly string[] = [];
const SKELETON_TREND =
  'M 0 64 L 8 56 L 16 68 L 24 47 L 32 58 L 40 39 L 48 51 L 56 35 L 64 45 L 72 29 L 80 43 L 88 25 L 96 37 L 100 31';

type MetricsLoad = 'loading' | 'ready' | 'error';

function ChartSkeleton(): React.JSX.Element {
  return (
    <div className="h-56 animate-pulse sm:h-64 xl:h-72" aria-hidden="true">
      <svg
        aria-hidden="true"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        className="h-full w-full overflow-visible"
      >
        <path
          d={SKELETON_TREND}
          fill="none"
          stroke="var(--chart-grid)"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    </div>
  );
}

function CenteredMessage({
  title,
  children,
}: {
  title: string;
  children?: React.ReactNode;
}): React.JSX.Element {
  return (
    <div className="flex flex-col items-center justify-center gap-1 py-16 text-center">
      <p className="font-semibold text-foreground text-sm">{title}</p>
      {children ? <div className="max-w-sm text-muted-foreground text-sm">{children}</div> : null}
    </div>
  );
}

function StaleBanner({
  onRetry,
  onDismiss,
}: {
  onRetry: () => void;
  onDismiss: () => void;
}): React.JSX.Element {
  return (
    <div className="flex items-center gap-3 rounded-md border border-border bg-metricyak-50 px-3 py-2 text-sm">
      <span className="flex-1 text-foreground">
        Couldn't refresh this metric — showing what you last loaded.
      </span>
      <button
        type="button"
        onClick={onRetry}
        className="inline-flex items-center gap-1.5 font-medium text-brand-orange-text underline-offset-4 hover:underline"
      >
        <RefreshCw className="size-3.5" />
        Retry
      </button>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss"
        className="text-muted-foreground transition-colors hover:text-foreground"
      >
        <X className="size-4" />
      </button>
    </div>
  );
}

export function MetricExplorePage(): React.JSX.Element {
  const { projectId, to } = useProjectRoute();
  const [searchParams, setSearchParams] = useSearchParams();
  const state = useMemo(() => readExploreState(searchParams), [searchParams]);

  const [nowMs, setNowMs] = useState(() => Date.now());
  const [plotFrame, setPlotFrame] = useState<HTMLDivElement | null>(null);
  const [plotWidthPx, setPlotWidthPx] = useState(DEFAULT_PLOT_WIDTH_PX);
  const [metrics, setMetrics] = useState<readonly Metric[]>([]);
  const [metricsLoad, setMetricsLoad] = useState<MetricsLoad>('loading');
  const [staleDismissed, setStaleDismissed] = useState(false);

  const patch = useCallback(
    (next: Partial<ExploreState>, replace = true): void => {
      setSearchParams(writeExploreState({ ...state, ...next }), { replace });
    },
    [setSearchParams, state],
  );

  useEffect(() => {
    let cancelled = false;
    setMetricsLoad('loading');
    listMetrics(projectId)
      .then((result) => {
        if (cancelled) return;
        setMetrics(result);
        setMetricsLoad('ready');
      })
      .catch(() => {
        if (!cancelled) setMetricsLoad('error');
      });
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  useEffect(() => {
    if (!plotFrame) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) setPlotWidthPx(entry.contentRect.width);
    });
    observer.observe(plotFrame);
    return () => observer.disconnect();
  }, [plotFrame]);

  const exploreMetrics = useMemo(() => metrics.map(toExploreMetric), [metrics]);
  const metric = state.metricId
    ? (exploreMetrics.find((candidate) => candidate.id === state.metricId) ?? null)
    : (exploreMetrics[0] ?? null);
  const metricMissing = metricsLoad === 'ready' && state.metricId !== null && metric === null;

  const range = useMemo(() => resolveWindow(state.window, nowMs), [state.window, nowMs]);
  const rangeSpanMs = range.toMs - range.fromMs;
  const granularityChoices = useMemo(() => granularityChoicesFor(rangeSpanMs), [rangeSpanMs]);
  const chosenGranularity =
    state.granularity !== null && granularityChoices.includes(state.granularity)
      ? state.granularity
      : null;
  const granularity = chosenGranularity ?? granularityForSpan(rangeSpanMs, plotWidthPx);

  const analysis = state.selection ?? range;
  const dimensions = metric?.dimensions ?? NO_DIMENSIONS;
  const dimension =
    state.property !== null && dimensions.includes(state.property)
      ? state.property
      : (dimensions[0] ?? null);

  const {
    series,
    stats,
    breakdown,
    loadingSeries,
    loadingValues,
    seriesFailed,
    valuesFailed,
    retry,
  } = useExploreData({
    projectId,
    metric,
    range,
    analysis,
    granularity,
    filters: state.filters,
    dimension,
  });

  const refreshFailed = seriesFailed || valuesFailed;
  useEffect(() => {
    if (!refreshFailed) setStaleDismissed(false);
  }, [refreshFailed]);

  const loadDimensionValues = useCallback(
    (name: string): Promise<readonly string[]> =>
      metric
        ? getMetricDimensionValues(
            projectId,
            metric.id,
            name,
            new Date(range.fromMs).toISOString(),
            new Date(range.toMs).toISOString(),
          )
        : Promise.resolve([]),
    [projectId, metric, range.fromMs, range.toMs],
  );

  if (metricsLoad === 'error') {
    return (
      <PageContainer width="wide" className="py-6">
        <CenteredMessage title="Couldn't load your metrics">
          Check your connection and reload the page.
        </CenteredMessage>
      </PageContainer>
    );
  }

  if (metricsLoad === 'ready' && exploreMetrics.length === 0) {
    return (
      <PageContainer width="content" className="py-16">
        <div className="flex flex-col items-center gap-3 text-center">
          <LineChart className="size-6 text-muted-foreground" />
          <p className="font-semibold text-foreground text-sm">Nothing to explore yet</p>
          <p className="max-w-sm text-muted-foreground text-sm">
            Define a metric and its trend shows up here as events arrive.
          </p>
          <Button asChild className="raised mt-1">
            <Link to={to('/metrics/catalogue/new')}>
              <Plus className="size-4" />
              New metric
            </Link>
          </Button>
        </div>
      </PageContainer>
    );
  }

  if (metricMissing) {
    return (
      <PageContainer width="wide" className="py-16">
        <CenteredMessage title="That metric isn't in this project">
          <p>It may have been deleted or moved to another project.</p>
          <Button
            variant="outline"
            className="mt-3"
            onClick={() => patch({ metricId: null, filters: [], selection: null, property: null })}
          >
            Explore another metric
          </Button>
        </CenteredMessage>
      </PageContainer>
    );
  }

  if (!metric) {
    return (
      <PageContainer width="wide" className="py-16">
        <CenteredMessage title="Loading your metrics…" />
      </PageContainer>
    );
  }

  const catalogueHref = to(`/metrics/catalogue/${metric.id}`);
  const loadedGranularity = series?.granularity ?? granularity;
  const bucketMs = GRANULARITY_MS[loadedGranularity];
  const direction = changeDirection(stats?.changeRatio ?? null);

  const chartBaseline = baselineGuideValue({
    kind: metric.kind,
    baseline: stats?.baseline ?? null,
    windowSpanMs: analysis.toMs - analysis.fromMs,
    bucketMs,
  });

  const chartNote =
    chartBaseline === null
      ? null
      : baselineGuideCaption(metric.kind, metric.name, loadedGranularity);

  const coverage = series === null ? null : seriesCoverage(series.points);
  const bucketCount = series?.points.length ?? 0;
  const idleMargin = coverage !== null && hasIdleMargin(coverage, bucketCount);

  const fitToRecordedData = (): void => {
    if (coverage === null) return;
    patch({
      window: {
        kind: 'custom',
        fromMs: coverage.firstRecordedMs,
        toMs: coverage.lastRecordedMs + bucketMs,
      },
      granularity: null,
      selection: null,
    });
  };

  const emptyWindowNote =
    state.filters.length > 0
      ? 'Nothing recorded here. Clear a filter or widen the range.'
      : 'Nothing recorded in this window. Try a wider range.';

  const setFilters = (filters: readonly ExploreFilter[]): void => {
    patch({ filters, selection: null });
  };

  return (
    <PageContainer width="wide" className="flex flex-col gap-4 py-5">
      <ExploreToolbar
        metrics={exploreMetrics}
        metric={metric}
        window={state.window}
        resolvedWindow={range}
        granularity={chosenGranularity}
        resolvedGranularity={granularity}
        granularityChoices={granularityChoices}
        filters={state.filters}
        freshness={`through ${formatBucketMoment(range.toMs)}`}
        catalogueHref={catalogueHref}
        loadDimensionValues={loadDimensionValues}
        onSelectMetric={(nextId) =>
          patch({ metricId: nextId, filters: [], selection: null, property: null })
        }
        onChangeWindow={(window) => {
          setNowMs(Date.now());
          patch({ window, granularity: null, selection: null });
        }}
        onChangeGranularity={(next) => patch({ granularity: next, selection: null })}
        onChangeFilters={setFilters}
      />

      {metric.dimensions.length === 0 ? (
        <p className="-mt-1 text-muted-foreground text-xs">
          This metric has no dimensions, so there's nothing to filter or break down by — add them in
          the{' '}
          <Link
            to={catalogueHref}
            className="text-brand-orange-text underline-offset-4 hover:underline"
          >
            metric definition
          </Link>
          .
        </p>
      ) : null}

      {series && stats ? (
        <MetricSummaryTiles tiles={summaryTilesFor(metric, stats, loadedGranularity)} />
      ) : null}

      <Surface padding="none" className="flex flex-col gap-3 px-4 py-4 sm:px-5">
        {series && refreshFailed && !staleDismissed ? (
          <StaleBanner onRetry={retry} onDismiss={() => setStaleDismissed(true)} />
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-semibold text-sm">
              {formatBucketMoment(analysis.fromMs)} → {formatBucketMoment(analysis.toMs)}
            </h2>
            <Badge variant="secondary" className={CHANGE_DIRECTION_CLASS[direction]}>
              {formatChangeRatio(stats?.changeRatio ?? null)}
            </Badge>
            <span className="text-muted-foreground text-xs">vs the window before it</span>
          </div>
          <div className="flex items-center gap-2">
            <p className="hidden text-muted-foreground text-xs sm:block">
              Drag across the chart to select a window
            </p>
            <Button
              variant="outline"
              size="sm"
              disabled={!state.selection}
              onClick={() =>
                state.selection
                  ? patch({
                      window: {
                        kind: 'custom',
                        fromMs: state.selection.fromMs,
                        toMs: state.selection.toMs,
                      },
                      granularity: null,
                      selection: null,
                    })
                  : undefined
              }
            >
              <ZoomIn className="size-3.5" />
              Zoom to selection
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={!state.selection}
              onClick={() => patch({ selection: null })}
            >
              <RotateCcw className="size-3.5" />
              Reset
            </Button>
          </div>
        </div>

        <div ref={setPlotFrame} className="relative">
          {series === null ? (
            seriesFailed ? (
              <CenteredMessage title="Couldn't load this metric">
                <button
                  type="button"
                  onClick={retry}
                  className="font-medium text-brand-orange-text underline-offset-4 hover:underline"
                >
                  Try again
                </button>
              </CenteredMessage>
            ) : (
              <ChartSkeleton />
            )
          ) : (
            <>
              <MetricChart
                metricName={metric.name}
                valueFormat={metric.valueFormat}
                granularity={loadedGranularity}
                points={series.points}
                bucketMs={bucketMs}
                plotWidthPx={plotWidthPx}
                baseline={chartBaseline}
                coverage={coverage}
                selection={state.selection}
                onSelect={(selection) => patch({ selection }, false)}
              />
              {coverage === null ? (
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                  <p className="rounded-md bg-background/85 px-3 py-1.5 text-muted-foreground text-sm">
                    {emptyWindowNote}
                  </p>
                </div>
              ) : null}
              <div
                aria-live="polite"
                className="absolute top-0 right-0 text-muted-foreground text-xs"
              >
                {loadingSeries ? 'Updating…' : ''}
              </div>
            </>
          )}
        </div>

        {idleMargin && coverage ? (
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
            <span className="text-foreground">{coverageNote(coverage, bucketCount)}</span>
            <button
              type="button"
              onClick={fitToRecordedData}
              className="font-medium text-brand-orange-text underline-offset-4 hover:underline"
            >
              Fit to data
            </button>
          </div>
        ) : null}

        {chartNote === null ? null : <p className="text-muted-foreground text-xs">{chartNote}</p>}
      </Surface>

      <ExploreTabs tab={state.tab} onChange={(tab) => patch({ tab })}>
        {state.tab === 'breakdown' ? (
          <PropertyBreakdown
            dimensions={metric.dimensions}
            dimension={dimension}
            valueFormat={metric.valueFormat}
            rows={breakdown}
            showShareOfChange={isAdditive(metric.kind)}
            filters={state.filters}
            loading={loadingValues}
            onSelectDimension={(name) => patch({ property: name })}
            onFilterTo={(filter) => setFilters([...state.filters, filter])}
          />
        ) : null}

        {state.tab === 'events' ? (
          <MetricEventsPanel
            projectId={projectId}
            metricId={metric.id}
            fromMs={analysis.fromMs}
            toMs={analysis.toMs}
            filters={state.filters}
          />
        ) : null}
      </ExploreTabs>
    </PageContainer>
  );
}
