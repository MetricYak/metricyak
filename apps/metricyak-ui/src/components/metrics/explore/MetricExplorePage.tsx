import { LineChart, Plus, RefreshCw, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { rangeCutoff } from '@/api/events';
import { getMetricSeries, type MetricSeries } from '@/api/metric-series';
import { listMetrics, type Metric } from '@/api/metrics';
import { PageContainer } from '@/components/shell/PageContainer';
import { Button } from '@/components/ui/button';
import { Surface } from '@/components/ui/surface';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { usePanelHeight } from '@/hooks/usePanelHeight';
import { useProjectRoute } from '@/hooks/useProjectRoute';
import { cn } from '@/lib/utils';
import { BucketEventsPanel } from './BucketEventsPanel';
import { ExploreToolbar } from './ExploreToolbar';
import { type ExploreState, readExploreState, writeExploreState } from './explore-url';
import { granularityFor } from './granularity';
import { MetricChart } from './MetricChart';

const DEFAULT_CHART_WIDTH = 900;

type MetricsLoad = 'loading' | 'ready' | 'error';

interface LoadedSeries {
  metricId: string;
  series: MetricSeries[];
  compare: MetricSeries[] | null;
}

function hasNoRecordedValue(series: readonly MetricSeries[]): boolean {
  return series.every((entry) => entry.points.every((point) => !point.value));
}

function ChartSkeleton(): React.JSX.Element {
  return (
    <div className="flex h-65 items-end gap-1.5 px-2 pb-6">
      {Array.from({ length: 24 }).map((_, index) => (
        <div
          // biome-ignore lint/suspicious/noArrayIndexKey: fixed skeleton list
          key={index}
          className="flex-1 animate-pulse rounded-t bg-metricyak-100"
          style={{ height: `${30 + ((index * 37) % 60)}%` }}
        />
      ))}
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

function StaleBanner({ onRetry, onDismiss }: { onRetry: () => void; onDismiss: () => void }) {
  return (
    <div className="mb-3 flex items-center gap-3 rounded-md border border-border bg-metricyak-50 px-3 py-2 text-sm">
      <span className="flex-1 text-foreground">
        Couldn't refresh the chart — showing what you last loaded.
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

  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [metricsLoad, setMetricsLoad] = useState<MetricsLoad>('loading');
  const [lastGood, setLastGood] = useState<LoadedSeries | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [chartWidth, setChartWidth] = useState(DEFAULT_CHART_WIDTH);
  const chartFrame = useRef<HTMLDivElement>(null);
  const requestId = useRef(0);
  const isDesktop = useMediaQuery('(min-width: 768px)');
  const panel = usePanelHeight({
    minHeight: 160,
    maxHeight: 520,
    defaultHeight: 280,
    storageKey: 'metricyak.explore-panel-height',
  });

  const applyState = useCallback(
    (next: ExploreState): void => {
      setSearchParams(writeExploreState(next), { replace: true });
    },
    [setSearchParams],
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
    const frame = chartFrame.current;
    if (!frame) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) setChartWidth(entry.contentRect.width);
    });
    observer.observe(frame);
    return () => observer.disconnect();
  }, []);

  const requestedMetric = state.metricId
    ? (metrics.find((candidate) => candidate.id === state.metricId) ?? null)
    : (metrics[0] ?? null);
  const metricMissing = state.metricId !== null && requestedMetric === null;

  const window = useMemo(() => {
    const nowMs = Date.now();
    const fromMs = rangeCutoff(state.range, nowMs) ?? nowMs;
    return { from: new Date(fromMs).toISOString(), to: new Date(nowMs).toISOString() };
  }, [state.range]);

  const granularity = state.granularity ?? granularityFor(state.range, chartWidth);
  const metricId = requestedMetric?.id ?? null;
  const drilling = state.selection !== null && !metricMissing;
  const fullScreenPanel = !isDesktop;

  const loadSeries = useCallback((): void => {
    if (!metricId) return;
    const id = ++requestId.current;
    setLoading(true);

    const spanMs = new Date(window.to).getTime() - new Date(window.from).getTime();
    const filters = state.filters.map((filter) => ({ name: filter.name, value: filter.value }));

    const primary = getMetricSeries(projectId, metricId, {
      from: window.from,
      to: window.to,
      granularity,
      splitBy: state.splitBy,
      filters,
    });
    const previous = state.compare
      ? getMetricSeries(projectId, metricId, {
          from: new Date(new Date(window.from).getTime() - spanMs).toISOString(),
          to: window.from,
          granularity,
          filters,
        })
      : Promise.resolve(null);

    Promise.all([primary, previous])
      .then(([current, compare]) => {
        if (id !== requestId.current) return;
        setLastGood({ metricId, series: current.series, compare: compare?.series ?? null });
        setFailed(false);
        setLoading(false);
      })
      .catch(() => {
        if (id !== requestId.current) return;
        setFailed(true);
        setLoading(false);
      });
  }, [
    projectId,
    metricId,
    window.from,
    window.to,
    granularity,
    state.splitBy,
    state.compare,
    state.filters,
  ]);

  useEffect(() => {
    loadSeries();
  }, [loadSeries]);

  if (metricsLoad === 'error') {
    return (
      <PageContainer width="wide" className="py-6">
        <CenteredMessage title="Couldn't load your metrics">
          Check your connection and reload the page.
        </CenteredMessage>
      </PageContainer>
    );
  }

  if (metricsLoad === 'ready' && metrics.length === 0) {
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

  const showing = lastGood && lastGood.metricId === metricId ? lastGood : null;

  return (
    <PageContainer
      width="wide"
      className="flex flex-col gap-4 py-6 md:h-full md:min-h-0 md:overflow-hidden"
    >
      <ExploreToolbar
        projectId={projectId}
        metrics={metrics}
        metric={requestedMetric}
        state={state}
        window={window}
        catalogueHref={to(`/metrics/catalogue/${metricId ?? ''}`)}
        onChange={applyState}
      />

      <Surface
        padding="none"
        className="flex min-h-80 flex-col p-4 md:min-h-0 md:flex-1 md:overflow-hidden"
      >
        {failed && showing ? (
          <StaleBanner onRetry={loadSeries} onDismiss={() => setFailed(false)} />
        ) : null}

        {showing?.compare && hasNoRecordedValue(showing.compare) ? (
          <p className="mb-3 text-muted-foreground text-xs">
            Nothing recorded in the previous period, so there's no comparison to draw.
          </p>
        ) : null}

        <div
          ref={chartFrame}
          className={cn('relative min-h-64 flex-1', drilling && fullScreenPanel && 'hidden')}
        >
          {metricMissing ? (
            <CenteredMessage title="That metric isn't in this project">
              Pick another from the menu above.
            </CenteredMessage>
          ) : showing ? (
            <>
              <MetricChart
                series={showing.series}
                compareSeries={showing.compare}
                definition={requestedMetric?.definition ?? { events: [] }}
                metricName={requestedMetric?.name ?? 'Metric'}
                granularity={granularity}
                selection={state.selection}
                onSelect={(selection) => applyState({ ...state, selection })}
              />
              {hasNoRecordedValue(showing.series) ? (
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                  <p className="rounded-md bg-background/85 px-3 py-1.5 text-muted-foreground text-sm">
                    Nothing recorded in this window.
                  </p>
                </div>
              ) : null}
              <div
                aria-live="polite"
                className={cn(
                  'absolute top-0 right-0 text-muted-foreground text-xs transition-opacity',
                  loading ? 'opacity-100' : 'opacity-0',
                )}
              >
                Updating…
              </div>
            </>
          ) : failed ? (
            <CenteredMessage title="Couldn't load this metric">
              <button
                type="button"
                onClick={loadSeries}
                className="font-medium text-brand-orange-text underline-offset-4 hover:underline"
              >
                Try again
              </button>
            </CenteredMessage>
          ) : (
            <ChartSkeleton />
          )}
        </div>

        {drilling && metricId && state.selection ? (
          <>
            {fullScreenPanel ? null : (
              <div
                {...panel.handleProps}
                data-resizing={panel.resizing}
                className="group/handle -mx-4 mt-2 h-3 shrink-0 cursor-row-resize touch-none select-none"
              >
                <div className="pointer-events-none mt-1.5 h-px w-full bg-border transition-[transform,background-color] group-hover/handle:scale-y-[3] group-hover/handle:bg-ring group-data-[resizing=true]/handle:scale-y-[3] group-data-[resizing=true]/handle:bg-ring" />
              </div>
            )}
            <div
              className={cn('flex min-h-0 flex-col', fullScreenPanel ? 'flex-1' : 'shrink-0')}
              style={fullScreenPanel ? undefined : { height: panel.height }}
            >
              <BucketEventsPanel
                key={`${state.selection.from}..${state.selection.to}`}
                projectId={projectId}
                metricId={metricId}
                selection={state.selection}
                filters={state.filters}
                fullScreen={fullScreenPanel}
                onClose={() => applyState({ ...state, selection: null })}
              />
            </div>
          </>
        ) : null}
      </Surface>
    </PageContainer>
  );
}
