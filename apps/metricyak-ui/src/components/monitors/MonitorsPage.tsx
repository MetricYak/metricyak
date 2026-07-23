import { BellRing, Plus } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { listMetrics } from '@/api/metrics';
import { listMonitors, type Monitor, setMonitorEnabled } from '@/api/monitors';
import { formatDateAgo } from '@/components/metrics/definitions/format';
import { conditionSentence } from '@/components/monitors/condition-sentence';
import { PageContainer } from '@/components/shell/PageContainer';
import { PageHeader } from '@/components/shell/PageHeader';
import { Button } from '@/components/ui/button';
import { Surface } from '@/components/ui/surface';
import { Switch } from '@/components/ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useProjectContext } from '@/contexts/ProjectContext';
import { MonitorStatusBadge } from './MonitorStatusBadge';

const PAGE_SIZE = 20;
type LoadState = 'loading' | 'ready' | 'error';

export function MonitorsPage(): React.JSX.Element {
  const { activeProject } = useProjectContext();
  const projectId = activeProject?.id ?? null;
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const page = Math.max(0, Number(searchParams.get('page') ?? '0') || 0);

  const [monitors, setMonitors] = useState<Monitor[]>([]);
  const [metricNames, setMetricNames] = useState<Map<string, string>>(new Map());
  const [hasMore, setHasMore] = useState(false);
  const [state, setState] = useState<LoadState>('loading');

  useEffect(() => {
    if (!projectId) return;
    let cancelled = false;
    setState('loading');
    Promise.all([listMonitors(projectId, { page, pageSize: PAGE_SIZE }), listMetrics(projectId)])
      .then(([monitorsPage, metrics]) => {
        if (cancelled) return;
        setMonitors(monitorsPage.monitors);
        setHasMore(monitorsPage.hasMore);
        setMetricNames(new Map(metrics.map((metric) => [metric.id, metric.name])));
        setState('ready');
      })
      .catch(() => {
        if (!cancelled) setState('error');
      });
    return () => {
      cancelled = true;
    };
  }, [projectId, page]);

  const setPage = (next: number): void => {
    setSearchParams(
      (prev) => {
        const params = new URLSearchParams(prev);
        params.set('page', String(next));
        return params;
      },
      { replace: true },
    );
  };

  const toggleEnabled = async (monitor: Monitor): Promise<void> => {
    if (!projectId) return;
    const next = !monitor.enabled;
    setMonitors((prev) =>
      prev.map((current) =>
        current.monitorId === monitor.monitorId ? { ...current, enabled: next } : current,
      ),
    );
    try {
      await setMonitorEnabled(projectId, monitor.monitorId, next);
    } catch {
      setMonitors((prev) =>
        prev.map((current) =>
          current.monitorId === monitor.monitorId
            ? { ...current, enabled: monitor.enabled }
            : current,
        ),
      );
      toast.error("Couldn't update the monitor");
    }
  };

  if (!projectId) {
    return (
      <PageContainer width="wide" className="py-16">
        <div className="flex flex-col items-center rounded-lg border border-border bg-metricyak-50 px-6 py-14 text-center">
          <span className="flex size-12 items-center justify-center rounded-full bg-metricyak-100">
            <BellRing className="size-5 text-muted-foreground" />
          </span>
          <h2 className="mt-4 font-semibold text-foreground text-sm">No project selected</h2>
          <p className="mt-1 max-w-sm text-muted-foreground text-sm">
            Pick a project from the switcher to see its monitors.
          </p>
        </div>
      </PageContainer>
    );
  }

  const newButton = (
    <Button asChild className="raised">
      <Link to="/monitors/new">
        <Plus className="size-4" />
        New monitor
      </Link>
    </Button>
  );

  const goToMonitor = (monitorId: string): void => {
    navigate(`/monitors/${monitorId}`);
  };

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        icon={BellRing}
        title="Monitors"
        description="Get told the moment a number crosses the line."
        actions={newButton}
      />
      <div className="min-h-0 flex-1 overflow-y-auto">
        <PageContainer width="wide" className="py-6">
          {state === 'error' ? (
            <div className="flex flex-col items-center gap-1 py-16 text-center">
              <p className="font-semibold text-foreground text-sm">Couldn't load your monitors</p>
              <p className="text-muted-foreground text-sm">Check your connection and reload.</p>
            </div>
          ) : state === 'ready' && monitors.length === 0 && page === 0 ? (
            <div className="flex flex-col items-center gap-3 py-16 text-center">
              <span className="flex size-12 items-center justify-center rounded-full bg-metricyak-100">
                <BellRing className="size-5 text-muted-foreground" />
              </span>
              <p className="font-semibold text-foreground text-sm">Nothing being watched yet</p>
              <p className="max-w-sm text-muted-foreground text-sm">
                Point a monitor at a metric and we'll tell you the moment it crosses the line.
              </p>
              {newButton}
            </div>
          ) : (
            <Surface padding="none" className="overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-metricyak-50 hover:bg-metricyak-50">
                    <TableHead className="h-9 pl-4 text-[11px]">Status</TableHead>
                    <TableHead className="h-9 text-[11px]">Monitor</TableHead>
                    <TableHead className="hidden h-9 text-[11px] md:table-cell">Watching</TableHead>
                    <TableHead className="h-9 text-[11px]">On</TableHead>
                    <TableHead className="hidden h-9 pr-4 text-[11px] md:table-cell">
                      Last checked
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {state === 'loading'
                    ? Array.from({ length: 6 }).map((_, index) => (
                        // biome-ignore lint/suspicious/noArrayIndexKey: fixed skeleton list
                        <TableRow key={index} className="hover:bg-transparent">
                          <TableCell className="py-3 pl-4">
                            <div className="h-3 w-16 animate-pulse rounded bg-metricyak-100" />
                          </TableCell>
                          <TableCell className="py-3">
                            <div className="h-3 w-40 animate-pulse rounded bg-metricyak-100" />
                          </TableCell>
                          <TableCell className="hidden py-3 md:table-cell">
                            <div className="h-3 w-48 animate-pulse rounded bg-metricyak-100" />
                          </TableCell>
                          <TableCell className="py-3">
                            <div className="h-4 w-9 animate-pulse rounded-full bg-metricyak-100" />
                          </TableCell>
                          <TableCell className="hidden py-3 pr-4 md:table-cell">
                            <div className="h-3 w-16 animate-pulse rounded bg-metricyak-100" />
                          </TableCell>
                        </TableRow>
                      ))
                    : monitors.map((monitor) => (
                        <TableRow
                          key={monitor.monitorId}
                          role="link"
                          tabIndex={0}
                          className="cursor-pointer"
                          onClick={() => goToMonitor(monitor.monitorId)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault();
                              goToMonitor(monitor.monitorId);
                            }
                          }}
                        >
                          <TableCell className="py-2.5 pl-4">
                            <MonitorStatusBadge monitor={monitor} />
                          </TableCell>
                          <TableCell className="py-2.5">
                            <span className="font-medium text-foreground text-sm">
                              {monitor.name}
                            </span>
                            {monitor.description ? (
                              <span className="block text-muted-foreground text-xs">
                                {monitor.description}
                              </span>
                            ) : null}
                          </TableCell>
                          <TableCell className="hidden py-2.5 text-muted-foreground text-sm md:table-cell">
                            {conditionSentence({
                              metricName: metricNames.get(monitor.metricId) ?? 'the metric',
                              operator: monitor.condition.operator,
                              value: monitor.condition.value,
                              window: monitor.window,
                              long: false,
                            })}
                          </TableCell>
                          <TableCell className="py-2.5">
                            {/* biome-ignore lint/a11y/noStaticElementInteractions: stops the click/key from reaching the row link; the Switch inside remains the sole interactive control */}
                            <span
                              onClick={(event) => event.stopPropagation()}
                              onKeyDown={(event) => event.stopPropagation()}
                            >
                              <Switch
                                checked={monitor.enabled}
                                onCheckedChange={() => toggleEnabled(monitor)}
                                aria-label={monitor.enabled ? 'Disable monitor' : 'Enable monitor'}
                              />
                            </span>
                          </TableCell>
                          <TableCell className="hidden py-2.5 pr-4 text-muted-foreground text-sm md:table-cell">
                            {monitor.lastEvaluatedAt ? formatDateAgo(monitor.lastEvaluatedAt) : '—'}
                          </TableCell>
                        </TableRow>
                      ))}
                </TableBody>
              </Table>
            </Surface>
          )}

          {state === 'ready' && (page > 0 || hasMore) ? (
            <div className="mt-4 flex items-center justify-end gap-3">
              <Button
                variant="outline"
                size="sm"
                disabled={page === 0}
                onClick={() => setPage(page - 1)}
              >
                Previous
              </Button>
              <span className="text-muted-foreground text-sm">Page {page + 1}</span>
              <Button
                variant="outline"
                size="sm"
                disabled={!hasMore}
                onClick={() => setPage(page + 1)}
              >
                Next
              </Button>
            </div>
          ) : null}
        </PageContainer>
      </div>
    </div>
  );
}
