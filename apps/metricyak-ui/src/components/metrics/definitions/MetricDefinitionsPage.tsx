import { Plus } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { listMetrics, type Metric } from '@/api/metrics';
import { Button } from '@/components/ui/button';
import { TableBody } from '@/components/ui/table';
import { useProjectContext } from '@/contexts/ProjectContext';
import {
  MetricDefinitionRow,
  MetricDefinitionsMessageRow,
  MetricDefinitionsSkeletonRows,
  MetricDefinitionsTableFrame,
  MetricDefinitionsTableHead,
} from './MetricDefinitionsTable';
import { isWelcomeBannerDismissed, MetricsWelcomeBanner } from './MetricsWelcomeBanner';

type LoadState = 'loading' | 'ready' | 'error';

export function MetricDefinitionsPage(): React.JSX.Element {
  const { activeProject } = useProjectContext();
  const projectId = activeProject?.id ?? null;
  const location = useLocation();
  const highlightId = (location.state as { highlightId?: string } | null)?.highlightId;

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

  const showBanner = state === 'ready' && metrics.length === 0 && !bannerDismissed;

  return (
    <div className="mx-auto max-w-5xl px-6 pt-8 pb-14 md:px-8">
      <div className="flex items-center justify-between gap-4">
        <h2 className="font-semibold text-foreground text-base">Metric definitions</h2>
        <Button asChild size="sm" className="raised">
          <Link to="/metrics/definitions/new">
            <Plus className="size-4" />
            New metric
          </Link>
        </Button>
      </div>

      {showBanner ? (
        <div className="mt-6">
          <MetricsWelcomeBanner onDismiss={() => setBannerDismissed(true)} />
        </div>
      ) : null}

      <div className={showBanner ? 'mt-8' : 'mt-6'}>
        <MetricDefinitionsTableFrame>
          <MetricDefinitionsTableHead />
          <TableBody>
            {state === 'loading' ? (
              <MetricDefinitionsSkeletonRows />
            ) : state === 'error' ? (
              <MetricDefinitionsMessageRow title="Couldn't load your metrics">
                Check your connection and reload the page.
              </MetricDefinitionsMessageRow>
            ) : metrics.length === 0 ? (
              <MetricDefinitionsMessageRow title="No metrics defined yet">
                Create one to start tracking a number that matters.
              </MetricDefinitionsMessageRow>
            ) : (
              metrics.map((metric) => (
                <MetricDefinitionRow
                  key={metric.id}
                  metric={metric}
                  highlighted={metric.id === highlightId}
                />
              ))
            )}
          </TableBody>
        </MetricDefinitionsTableFrame>
      </div>
    </div>
  );
}
