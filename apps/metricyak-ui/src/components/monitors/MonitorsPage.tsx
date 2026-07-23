import type { ColumnDef } from '@tanstack/react-table';
import { BellRing, Plus, Search, SearchX } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { listMetrics } from '@/api/metrics';
import {
  listMonitors,
  type Monitor,
  type MonitorStatusFilter,
  setMonitorEnabled,
} from '@/api/monitors';
import { DataTable } from '@/components/data-table/DataTable';
import {
  type DataTablePageSize,
  DataTablePagination,
} from '@/components/data-table/DataTablePagination';
import { formatDateAgo } from '@/components/metrics/definitions/format';
import { conditionSentence } from '@/components/monitors/condition-sentence';
import { PageContainer } from '@/components/shell/PageContainer';
import { PageHeader } from '@/components/shell/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useProjectContext } from '@/contexts/ProjectContext';
import { MonitorStatusBadge } from './MonitorStatusBadge';

type StatusOption = MonitorStatusFilter | 'all';

const STATUS_OPTIONS: readonly { value: StatusOption; label: string }[] = [
  { value: 'all', label: 'All statuses' },
  { value: 'watching', label: 'Watching' },
  { value: 'pending', label: 'Pending' },
  { value: 'firing', label: 'Firing' },
  { value: 'error', label: 'Error' },
  { value: 'paused', label: 'Paused' },
];

type MonitorsQuery = {
  page: number;
  pageSize: DataTablePageSize;
  q: string;
  status: StatusOption;
};

const DEFAULT_QUERY: MonitorsQuery = { page: 0, pageSize: 25, q: '', status: 'all' };

function MonitorsView({ projectId }: { projectId: string }): React.JSX.Element {
  const [query, setQuery] = useState<MonitorsQuery>(DEFAULT_QUERY);
  const [monitors, setMonitors] = useState<Monitor[]>([]);
  const [metricNames, setMetricNames] = useState<Map<string, string>>(new Map());
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [errored, setErrored] = useState(false);
  const [loadedOnce, setLoadedOnce] = useState(false);
  const reqRef = useRef(0);

  useEffect(() => {
    let cancelled = false;
    listMetrics(projectId)
      .then((metrics) => {
        if (!cancelled) setMetricNames(new Map(metrics.map((metric) => [metric.id, metric.name])));
      })
      .catch(() => {
        if (!cancelled) setMetricNames(new Map());
      });
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  useEffect(() => {
    const reqId = ++reqRef.current;
    setLoading(true);
    const run = (): void => {
      listMonitors(projectId, {
        page: query.page,
        pageSize: query.pageSize,
        q: query.q.trim() || undefined,
        status: query.status === 'all' ? undefined : query.status,
      })
        .then((result) => {
          if (reqId !== reqRef.current) return;
          setMonitors(result.monitors);
          setHasMore(result.hasMore);
          setErrored(false);
          setLoadedOnce(true);
        })
        .catch(() => {
          if (reqId === reqRef.current) setErrored(true);
        })
        .finally(() => {
          if (reqId === reqRef.current) setLoading(false);
        });
    };
    const handle = setTimeout(run, 250);
    return () => clearTimeout(handle);
  }, [projectId, query]);

  const toggleEnabled = useCallback(
    async (monitor: Monitor): Promise<void> => {
      const next = !monitor.enabled;
      setMonitors((prev) =>
        prev.map((m) => (m.monitorId === monitor.monitorId ? { ...m, enabled: next } : m)),
      );
      try {
        await setMonitorEnabled(projectId, monitor.monitorId, next);
      } catch {
        setMonitors((prev) =>
          prev.map((m) =>
            m.monitorId === monitor.monitorId ? { ...m, enabled: monitor.enabled } : m,
          ),
        );
        toast.error("Couldn't update the monitor");
      }
    },
    [projectId],
  );

  const columns = useMemo<ColumnDef<Monitor, unknown>[]>(
    () => [
      {
        id: 'status',
        header: 'Status',
        cell: ({ row }) => <MonitorStatusBadge monitor={row.original} />,
      },
      {
        id: 'name',
        header: 'Monitor',
        cell: ({ row }) => (
          <div className="min-w-0">
            <Link
              to={`/monitors/${row.original.monitorId}`}
              className="font-medium text-foreground text-sm hover:text-brand-orange-text hover:underline"
            >
              {row.original.name}
            </Link>
            {row.original.description ? (
              <p className="truncate text-muted-foreground text-xs">{row.original.description}</p>
            ) : null}
          </div>
        ),
      },
      {
        id: 'watching',
        header: 'Watching',
        cell: ({ row }) => (
          <span className="text-muted-foreground text-sm">
            {conditionSentence({
              metricName: metricNames.get(row.original.metricId) ?? 'the metric',
              operator: row.original.condition.operator,
              value: row.original.condition.value,
              window: row.original.window,
              long: false,
            })}
          </span>
        ),
      },
      {
        id: 'enabled',
        header: 'On',
        cell: ({ row }) => (
          <Switch
            checked={row.original.enabled}
            onCheckedChange={() => void toggleEnabled(row.original)}
            aria-label={row.original.enabled ? 'Disable monitor' : 'Enable monitor'}
          />
        ),
      },
      {
        id: 'lastChecked',
        header: 'Last checked',
        cell: ({ row }) => (
          <span className="text-muted-foreground text-sm">
            {row.original.lastEvaluatedAt ? formatDateAgo(row.original.lastEvaluatedAt) : '—'}
          </span>
        ),
      },
    ],
    [metricNames, toggleEnabled],
  );

  const filtersActive = query.q.trim().length > 0 || query.status !== 'all';

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        icon={BellRing}
        title="Monitors"
        description="Get told the moment a number crosses the line."
        actions={
          <Button asChild className="raised">
            <Link to="/monitors/new">
              <Plus className="size-4" />
              New monitor
            </Link>
          </Button>
        }
      />
      <div className="min-h-0 flex-1 overflow-y-auto">
        <PageContainer width="wide" className="py-6">
          <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-2.5">
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query.q}
                onChange={(event) =>
                  setQuery((prev) => ({ ...prev, q: event.target.value, page: 0 }))
                }
                placeholder="Search monitors"
                className="h-9 w-56 pl-8"
              />
            </div>
            <Select
              value={query.status}
              onValueChange={(value) => {
                const option = STATUS_OPTIONS.find((candidate) => candidate.value === value);
                if (option) setQuery((prev) => ({ ...prev, status: option.value, page: 0 }));
              }}
            >
              <SelectTrigger className="h-9 w-40" size="sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <DataTable
            columns={columns}
            data={monitors}
            getRowId={(monitor) => monitor.monitorId}
            isLoading={loading && !loadedOnce}
            skeletonRowCount={8}
            errorBanner={
              errored ? (
                <div className="mb-3 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-destructive text-sm">
                  Couldn't load your monitors. Check your connection and try again.
                </div>
              ) : undefined
            }
            emptyState={
              filtersActive
                ? {
                    icon: <SearchX className="size-5" />,
                    title: 'No monitors match',
                    description: 'Try a different search or status filter.',
                  }
                : {
                    icon: <BellRing className="size-5" />,
                    title: 'Nothing being watched yet',
                    description:
                      "Point a monitor at a metric and we'll tell you the moment it crosses the line.",
                  }
            }
          />

          {loadedOnce && (monitors.length > 0 || query.page > 0) ? (
            <DataTablePagination
              pageSize={query.pageSize}
              onPageSizeChange={(size) =>
                setQuery((prev) => ({ ...prev, pageSize: size, page: 0 }))
              }
              hasPrev={query.page > 0}
              hasNext={hasMore}
              onPrev={() => setQuery((prev) => ({ ...prev, page: Math.max(0, prev.page - 1) }))}
              onNext={() => setQuery((prev) => ({ ...prev, page: prev.page + 1 }))}
            />
          ) : null}
        </PageContainer>
      </div>
    </div>
  );
}

export function MonitorsPage(): React.JSX.Element {
  const { activeProject } = useProjectContext();
  const projectId = activeProject?.id ?? null;

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

  return <MonitorsView key={projectId} projectId={projectId} />;
}
