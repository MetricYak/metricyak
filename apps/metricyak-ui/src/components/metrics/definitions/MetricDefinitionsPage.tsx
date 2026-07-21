import { ArrowLeft, Plus } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { listMetrics, type Metric } from '@/api/metrics';
import { PageContainer } from '@/components/shell/PageContainer';
import { Button } from '@/components/ui/button';
import { Surface } from '@/components/ui/surface';
import { useProjectContext } from '@/contexts/ProjectContext';
import { MetricDetailPanel } from './MetricDetailPanel';
import { MetricList } from './MetricList';
import { isWelcomeBannerDismissed, MetricsWelcomeBanner } from './MetricsWelcomeBanner';

type LoadState = 'loading' | 'ready' | 'error';

function AsideSkeleton(): React.JSX.Element {
  return (
    <div className="space-y-1">
      {Array.from({ length: 6 }).map((_, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: fixed skeleton list
        <div key={index} className="flex items-center gap-3 px-3 py-2.5">
          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="h-3.5 w-32 animate-pulse rounded bg-metricyak-100" />
            <div className="h-3 w-24 animate-pulse rounded bg-metricyak-100" />
          </div>
          <div className="h-3 w-12 animate-pulse rounded bg-metricyak-100" />
        </div>
      ))}
    </div>
  );
}

function CenteredMessage({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-1 text-center">
      <p className="font-semibold text-foreground text-sm">{title}</p>
      <p className="max-w-xs text-muted-foreground text-sm">{children}</p>
    </div>
  );
}

export function MetricDefinitionsPage(): React.JSX.Element {
  const { activeProject } = useProjectContext();
  const projectId = activeProject?.id ?? null;
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const selectedParam = searchParams.get('m');

  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [state, setState] = useState<LoadState>('loading');
  const [bannerDismissed, setBannerDismissed] = useState(isWelcomeBannerDismissed);

  useEffect(() => {
    if (!projectId) return;
    let cancelled = false;
    setState('loading');
    listMetrics(projectId)
      .then((result) => {
        if (cancelled) return;
        setMetrics(result);
        setState('ready');
      })
      .catch(() => {
        if (!cancelled) setState('error');
      });
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const setSelected = (id: string | null): void => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (id) next.set('m', id);
        else next.delete('m');
        return next;
      },
      { replace: true },
    );
  };

  if (state === 'error') {
    return (
      <PageContainer width="wide" className="py-16">
        <CenteredMessage title="Couldn't load your metrics">
          Check your connection and reload the page.
        </CenteredMessage>
      </PageContainer>
    );
  }

  if (state === 'ready' && metrics.length === 0) {
    return (
      <PageContainer width="content" className="py-10">
        {bannerDismissed ? (
          <div className="flex flex-col items-center gap-3 py-10 text-center">
            <p className="font-semibold text-foreground text-sm">No metrics yet</p>
            <Button asChild className="raised">
              <Link to="/metrics/definitions/new">
                <Plus className="size-4" />
                New metric
              </Link>
            </Button>
          </div>
        ) : (
          <MetricsWelcomeBanner onDismiss={() => setBannerDismissed(true)} />
        )}
      </PageContainer>
    );
  }

  const selectedMetric =
    metrics.find((metric) => metric.id === selectedParam) ?? metrics[0] ?? null;
  const justCreatedId =
    (location.state as { justCreatedId?: string } | null)?.justCreatedId ?? null;
  const justCreated = justCreatedId != null && selectedMetric?.id === justCreatedId;

  return (
    <PageContainer
      width="wide"
      className="flex flex-col gap-6 py-6 md:h-full md:min-h-0 md:flex-row"
    >
      <Surface
        padding="none"
        className={`w-full flex-col md:flex md:min-h-0 md:w-[320px] md:shrink-0 md:overflow-hidden lg:w-[360px] ${
          selectedParam ? 'hidden' : 'flex'
        }`}
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-border border-b px-3 py-2.5">
          <span className="font-medium text-foreground text-sm">
            {metrics.length} {metrics.length === 1 ? 'metric' : 'metrics'}
          </span>
          <Button asChild size="sm" className="raised">
            <Link to="/metrics/definitions/new">
              <Plus className="size-4" />
              New metric
            </Link>
          </Button>
        </div>
        {state === 'loading' ? (
          <div className="p-3">
            <AsideSkeleton />
          </div>
        ) : (
          <div className="flex flex-col p-3 md:min-h-0 md:flex-1">
            <MetricList
              metrics={metrics}
              selectedId={selectedMetric?.id ?? null}
              onSelect={setSelected}
            />
          </div>
        )}
      </Surface>

      <section
        className={`min-w-0 flex-1 flex-col md:min-h-0 md:overflow-y-auto ${
          selectedParam ? 'flex' : 'hidden md:flex'
        }`}
      >
        <button
          type="button"
          onClick={() => setSelected(null)}
          className="mb-4 inline-flex items-center gap-1.5 self-start text-muted-foreground text-sm hover:text-foreground md:hidden"
        >
          <ArrowLeft className="size-4" />
          All metrics
        </button>
        {selectedMetric ? (
          <MetricDetailPanel metric={selectedMetric} justCreated={justCreated} />
        ) : (
          <CenteredMessage title="Pick a metric">
            Choose a metric on the left to see its definition and monitors.
          </CenteredMessage>
        )}
      </section>
    </PageContainer>
  );
}
