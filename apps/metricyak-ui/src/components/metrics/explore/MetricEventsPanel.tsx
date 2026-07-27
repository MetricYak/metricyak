import type { ColumnDef } from '@tanstack/react-table';
import { SearchX } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { RealEvent } from '@/api/events';
import { getMetricEvents } from '@/api/metric-series';
import { DataTable } from '@/components/data-table/DataTable';
import {
  type DataTablePageSize,
  DataTablePagination,
} from '@/components/data-table/DataTablePagination';
import { eventColumns } from '@/components/events/event-columns';
import { type ExploreFilter, formatFilter, parseFilter } from './explore-url';
import { formatEventCount } from './format';

const DEFAULT_PAGE_SIZE: DataTablePageSize = 25;
const FILTER_SEPARATOR = '\n';

interface LoadedPage {
  readonly events: readonly RealEvent[];
  readonly hasMore: boolean;
  readonly page: number;
  readonly pageSize: DataTablePageSize;
}

interface MetricEventsPanelProps {
  projectId: string;
  metricId: string;
  fromMs: number;
  toMs: number;
  filters: readonly ExploreFilter[];
}

export function MetricEventsPanel({
  projectId,
  metricId,
  fromMs,
  toMs,
  filters,
}: MetricEventsPanelProps): React.JSX.Element {
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState<DataTablePageSize>(DEFAULT_PAGE_SIZE);
  const [loaded, setLoaded] = useState<LoadedPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const requestId = useRef(0);

  const filterKey = filters.map(formatFilter).join(FILTER_SEPARATOR);
  const windowKey = `${projectId}|${metricId}|${fromMs}|${toMs}|${filterKey}`;
  const [lastWindowKey, setLastWindowKey] = useState(windowKey);
  if (windowKey !== lastWindowKey) {
    setLastWindowKey(windowKey);
    setPage(0);
  }

  const columns = useMemo<ColumnDef<RealEvent, unknown>[]>(() => eventColumns('Time'), []);

  const requestFilters = useMemo(
    () =>
      filterKey.split(FILTER_SEPARATOR).flatMap((entry) => {
        const filter = parseFilter(entry);
        return filter ? [{ name: filter.name, value: filter.value }] : [];
      }),
    [filterKey],
  );

  const load = useCallback((): void => {
    const id = ++requestId.current;
    setLoading(true);
    getMetricEvents(projectId, metricId, {
      from: new Date(fromMs).toISOString(),
      to: new Date(toMs).toISOString(),
      filters: requestFilters,
      page,
      pageSize,
      sort: 'desc',
    })
      .then((result) => {
        if (id !== requestId.current) return;
        setLoaded({ events: result.events, hasMore: result.hasMore, page, pageSize });
        setFailed(false);
        setLoading(false);
      })
      .catch(() => {
        if (id !== requestId.current) return;
        setFailed(true);
        setLoading(false);
      });
  }, [projectId, metricId, fromMs, toMs, requestFilters, page, pageSize]);

  useEffect(() => {
    load();
  }, [load]);

  if (failed && loaded === null) {
    return (
      <div className="flex flex-col items-center gap-2 py-12 text-center">
        <p className="font-semibold text-foreground text-sm">Couldn't load these events</p>
        <button
          type="button"
          onClick={load}
          className="font-medium text-brand-orange-text text-sm underline-offset-4 hover:underline"
        >
          Try again
        </button>
      </div>
    );
  }

  const events = loaded?.events ?? [];

  return (
    <div className="flex flex-col gap-3 p-4 sm:p-5">
      <p className="text-muted-foreground text-xs">
        {formatEventCount({
          page: loaded?.page ?? page,
          pageSize: loaded?.pageSize ?? pageSize,
          loadedCount: events.length,
          hasMore: loaded?.hasMore ?? false,
        })}
      </p>

      <DataTable
        columns={columns}
        data={events}
        getRowId={(event) => event.id}
        isLoading={loading && loaded === null}
        skeletonRowCount={10}
        minWidthClassName="min-w-192"
        errorBanner={
          failed ? (
            <div className="mb-3 flex items-center justify-between gap-3 rounded-md border border-border bg-metricyak-50 px-3 py-2 text-sm">
              <span>Couldn't refresh these events — showing what you last loaded.</span>
              <button type="button" onClick={load} className="font-medium underline">
                Retry
              </button>
            </div>
          ) : undefined
        }
        emptyState={{
          icon: <SearchX className="size-5" />,
          title: 'No events in this window',
          description: 'Widen the time range or clear a filter to see the stream.',
        }}
      />

      {events.length > 0 ? (
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
      ) : null}
    </div>
  );
}
