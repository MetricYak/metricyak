import type { ColumnDef } from '@tanstack/react-table';
import { ArrowLeft, ExternalLink, SearchX, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import type { RealEvent } from '@/api/events';
import { getMetricEvents } from '@/api/metric-series';
import { DataTable } from '@/components/data-table/DataTable';
import {
  type DataTablePageSize,
  DataTablePagination,
} from '@/components/data-table/DataTablePagination';
import { eventColumns } from '@/components/events/event-columns';
import { useProjectRoute } from '@/hooks/useProjectRoute';
import type { ExploreFilter, ExploreSelection } from './explore-url';
import { formatSpan } from './format';

interface LoadedPage {
  events: RealEvent[];
  hasMore: boolean;
}

interface BucketEventsPanelProps {
  projectId: string;
  metricId: string;
  selection: ExploreSelection;
  filters: readonly ExploreFilter[];
  fullScreen: boolean;
  onClose: () => void;
}

export function BucketEventsPanel({
  projectId,
  metricId,
  selection,
  filters,
  fullScreen,
  onClose,
}: BucketEventsPanelProps): React.JSX.Element {
  const { to } = useProjectRoute();
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState<DataTablePageSize>(25);
  const [loaded, setLoaded] = useState<LoadedPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const requestId = useRef(0);

  const columns = useMemo<ColumnDef<RealEvent, unknown>[]>(() => eventColumns('Time'), []);

  const load = useCallback((): void => {
    const id = ++requestId.current;
    setLoading(true);
    getMetricEvents(projectId, metricId, {
      from: selection.from,
      to: selection.to,
      filters: filters.map((filter) => ({ name: filter.name, value: filter.value })),
      page,
      pageSize,
      sort: 'asc',
    })
      .then((result) => {
        if (id !== requestId.current) return;
        setLoaded({ events: result.events, hasMore: result.hasMore });
        setFailed(false);
        setLoading(false);
      })
      .catch(() => {
        if (id !== requestId.current) return;
        setFailed(true);
        setLoading(false);
      });
  }, [projectId, metricId, selection.from, selection.to, filters, page, pageSize]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const events = loaded?.events ?? [];
  const filterSummary = filters.map((filter) => `${filter.name} = ${filter.value}`).join(' · ');

  return (
    <section
      aria-label="Events behind the selected range"
      className="flex min-h-0 flex-1 flex-col overflow-hidden"
    >
      <header className="flex shrink-0 items-center gap-3 pb-3">
        {fullScreen ? (
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-1.5 text-muted-foreground text-sm transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
            Chart
          </button>
        ) : null}

        <div className="min-w-0 flex-1">
          <p className="truncate font-medium text-foreground text-sm">
            {formatSpan(selection.from, selection.to)}
          </p>
          {filterSummary ? (
            <p className="truncate text-muted-foreground text-xs">{filterSummary}</p>
          ) : null}
        </div>

        <Link
          to={to(`/activity/explore?from=${encodeURIComponent(selection.from)}`)}
          className="inline-flex shrink-0 items-center gap-1.5 text-brand-orange-text text-sm underline-offset-4 hover:underline"
        >
          Open in Events
          <ExternalLink className="size-3.5" />
        </Link>

        {fullScreen ? null : (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close events panel"
            className="shrink-0 text-muted-foreground transition-colors hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        )}
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <DataTable
          columns={columns}
          data={events}
          getRowId={(event) => event.id}
          isLoading={loading && !loaded}
          skeletonRowCount={Math.min(pageSize, 8)}
          errorBanner={
            failed && loaded ? (
              <div className="mb-3 flex items-center justify-between gap-3 rounded-md border border-border bg-metricyak-50 px-3 py-2 text-sm">
                <span>Couldn't refresh these events — showing what you last loaded.</span>
                <button type="button" onClick={load} className="font-medium underline">
                  Retry
                </button>
              </div>
            ) : undefined
          }
          emptyState={
            failed
              ? {
                  icon: <SearchX className="size-5" />,
                  title: "Couldn't load these events",
                  description: 'Something went wrong fetching this range.',
                }
              : {
                  icon: <SearchX className="size-5" />,
                  title: 'No events in this range',
                  description: 'Nothing the metric counts landed in the span you picked.',
                }
          }
        />
      </div>

      {events.length > 0 ? (
        <div className="shrink-0">
          <DataTablePagination
            pageSize={pageSize}
            onPageSizeChange={(size) => {
              setPageSize(size);
              setPage(0);
            }}
            hasPrev={page > 0}
            hasNext={loaded?.hasMore ?? false}
            onPrev={() => setPage((current) => Math.max(0, current - 1))}
            onNext={() => setPage((current) => current + 1)}
          />
        </div>
      ) : null}
    </section>
  );
}
