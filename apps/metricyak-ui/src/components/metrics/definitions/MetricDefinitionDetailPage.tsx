import { ArrowLeft, BellPlus, Check } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { listMetrics, type Metric } from '@/api/metrics';
import { Badge } from '@/components/ui/badge';
import { useProjectContext } from '@/contexts/ProjectContext';
import { DefinitionSummary } from './DefinitionSummary';
import { formatDateAgo } from './format';

type LoadState =
  | { kind: 'loading' }
  | { kind: 'ready'; metric: Metric }
  | { kind: 'not-found' }
  | { kind: 'error' };

interface DetailRouteState {
  metric?: Metric;
  justCreated?: boolean;
}

export function MetricDefinitionDetailPage(): React.JSX.Element {
  const { metricId } = useParams<{ metricId: string }>();
  const { activeProject } = useProjectContext();
  const projectId = activeProject?.id ?? null;
  const routeState = (useLocation().state as DetailRouteState | null) ?? {};

  const [state, setState] = useState<LoadState>(
    routeState.metric ? { kind: 'ready', metric: routeState.metric } : { kind: 'loading' },
  );

  useEffect(() => {
    if (routeState.metric || !projectId || !metricId) return;
    let cancelled = false;
    setState({ kind: 'loading' });
    listMetrics(projectId)
      .then((metrics) => {
        if (cancelled) return;
        const match = metrics.find((metric) => metric.id === metricId);
        setState(match ? { kind: 'ready', metric: match } : { kind: 'not-found' });
      })
      .catch(() => {
        if (!cancelled) setState({ kind: 'error' });
      });
    return () => {
      cancelled = true;
    };
  }, [projectId, metricId, routeState.metric]);

  return (
    <div className="mx-auto max-w-3xl px-6 py-8 md:px-8">
      <Link
        to="/metrics/definitions"
        className="inline-flex items-center gap-1.5 text-muted-foreground text-sm hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Back to definitions
      </Link>

      {state.kind === 'loading' ? (
        <div className="mt-6 space-y-3">
          <div className="h-6 w-56 animate-pulse rounded bg-metricyak-100" />
          <div className="h-24 w-full animate-pulse rounded-lg bg-metricyak-100" />
        </div>
      ) : state.kind === 'not-found' ? (
        <DetailMessage title="We couldn't find that metric">
          It may have been deleted. Head back to your definitions to pick another.
        </DetailMessage>
      ) : state.kind === 'error' ? (
        <DetailMessage title="Couldn't load this metric">
          Check your connection and reload the page.
        </DetailMessage>
      ) : (
        <MetricDetail metric={state.metric} justCreated={routeState.justCreated ?? false} />
      )}
    </div>
  );
}

function MetricDetail({
  metric,
  justCreated,
}: {
  metric: Metric;
  justCreated: boolean;
}): React.JSX.Element {
  return (
    <>
      {justCreated ? (
        <div className="mt-6 flex items-center gap-2 rounded-lg border border-border bg-metricyak-50 px-4 py-2.5 text-sm">
          <Check className="size-4 shrink-0 text-metricyak-brand-orange" />
          <span className="font-medium text-foreground">Metric created.</span>
          <span className="text-muted-foreground">
            It starts filling in as matching events arrive.
          </span>
        </div>
      ) : null}

      <div className="mt-6">
        <h1 className="font-semibold text-foreground text-xl">{metric.name}</h1>
        {metric.description ? (
          <p className="mt-1 text-muted-foreground text-sm">{metric.description}</p>
        ) : null}
        <p className="mt-2 text-muted-foreground text-xs">
          Created {formatDateAgo(metric.createdAt).toLowerCase()}
        </p>
      </div>

      <section className="mt-6">
        <h2 className="font-semibold text-foreground text-sm">Definition</h2>
        <div className="mt-2">
          <DefinitionSummary definition={metric.definition} />
        </div>
      </section>

      <section className="mt-8 rounded-lg border border-border border-dashed p-5">
        <div className="flex items-center gap-2">
          <BellPlus className="size-4 shrink-0 text-muted-foreground" />
          <h2 className="font-semibold text-foreground text-sm">Monitor this metric</h2>
          <Badge variant="secondary">Coming soon</Badge>
        </div>
        <p className="mt-1 max-w-md text-muted-foreground text-sm">
          Soon you'll be told when {metric.name} crosses a threshold — routed to Slack, email, or a
          workflow.
        </p>
      </section>
    </>
  );
}

function DetailMessage({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <div className="mt-16 flex flex-col items-center gap-1 text-center">
      <p className="font-semibold text-foreground text-sm">{title}</p>
      <p className="max-w-sm text-muted-foreground text-sm">{children}</p>
    </div>
  );
}
