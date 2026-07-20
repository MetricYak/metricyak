import type { ColumnDef } from '@tanstack/react-table';
import { ChevronDown, RefreshCw, SearchX } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  type EventSort,
  listEvents,
  rangeCutoff,
  type RealEvent,
  type TimeRange,
} from '@/api/events';
import { DataTable } from '@/components/data-table/DataTable';
import {
  type DataTablePageSize,
  DataTablePagination,
} from '@/components/data-table/DataTablePagination';
import { cn } from '@/lib/utils';
import { formatCompact } from './format';
import { TimeRangeSelect } from './TimeRangeSelect';

const PROPERTIES_PREVIEW_LIMIT = 4;

function formatPropertyPreviewValue(value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number') return Number.isInteger(value) ? String(value) : value.toFixed(2);
  if (typeof value === 'string') return value;
  return JSON.stringify(value);
}

function PropertiesPreviewCell({
  properties,
}: {
  properties: Record<string, unknown>;
}): React.JSX.Element {
  const entries = Object.entries(properties);
  const preview = entries.slice(0, PROPERTIES_PREVIEW_LIMIT);
  const overflow = entries.length - preview.length;
  return (
    <span className="flex items-center gap-3 font-mono text-[12px] text-muted-foreground">
      {preview.map(([key, value]) => (
        <span key={key} className="truncate">
          <span className="text-metricyak-500">{key}</span>
          <span className="text-metricyak-400">=</span>
          <span className="text-metricyak-700">{formatPropertyPreviewValue(value)}</span>
        </span>
      ))}
      {overflow > 0 && <span className="text-metricyak-400">+{overflow}</span>}
    </span>
  );
}

interface ExplorerQuery {
  page: number;
  pageSize: DataTablePageSize;
  range: TimeRange;
  sort: EventSort;
}

const DEFAULT_QUERY: ExplorerQuery = { page: 0, pageSize: 25, range: '24h', sort: 'time-desc' };

interface LoadedPage {
  query: ExplorerQuery;
  events: RealEvent[];
  hasMore: boolean;
}

export function EventsExplorer({ projectId }: { projectId: string }): React.JSX.Element {
  const [query, setQuery] = useState<ExplorerQuery>(DEFAULT_QUERY);
  const [lastGood, setLastGood] = useState<LoadedPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [bannerError, setBannerError] = useState(false);
  const reqRef = useRef(0);

  const load = useCallback(
    async (next: ExplorerQuery) => {
      const reqId = ++reqRef.current;
      setLoading(true);
      try {
        const cutoff = rangeCutoff(next.range, Date.now());
        const res = await listEvents(projectId, {
          from: cutoff ? new Date(cutoff).toISOString() : undefined,
          sort: next.sort,
          page: next.page,
          pageSize: next.pageSize,
        });
        if (reqId !== reqRef.current) return;
        setLastGood({ query: next, events: res.events, hasMore: res.hasMore });
        setQuery(next);
        setBannerError(false);
      } catch {
        if (reqId !== reqRef.current) return;
        setBannerError(true);
      } finally {
        if (reqId === reqRef.current) setLoading(false);
      }
    },
    [projectId],
  );

  useEffect(() => {
    void load(DEFAULT_QUERY);
  }, [load]);

  const columns = useMemo<ColumnDef<RealEvent, unknown>[]>(
    () => [
      {
        id: 'time',
        header: () => (
          <button
            type="button"
            onClick={() =>
              void load({ ...query, sort: query.sort === 'time-desc' ? 'time-asc' : 'time-desc' })
            }
            className="inline-flex items-center gap-1 transition-colors hover:text-foreground"
          >
            Time
            <ChevronDown
              className={cn(
                'size-3.5 transition-transform',
                query.sort === 'time-asc' && 'rotate-180',
              )}
            />
          </button>
        ),
        cell: ({ row }) => (
          <span className="text-[12px] text-muted-foreground tabular-nums">
            {formatCompact(row.original.timestamp)}
          </span>
        ),
      },
      {
        id: 'name',
        header: 'Event',
        cell: ({ row }) => (
          <span className="font-medium text-foreground text-sm">{row.original.name}</span>
        ),
      },
      {
        id: 'properties',
        header: 'Properties',
        cell: ({ row }) => <PropertiesPreviewCell properties={row.original.properties} />,
      },
    ],
    [query, load],
  );

  const events = lastGood?.events ?? [];
  const hasMore = lastGood?.hasMore ?? false;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-2.5">
        <TimeRangeSelect
          value={query.range}
          onChange={(r) => void load({ ...query, range: r, page: 0 })}
        />
        <button
          type="button"
          onClick={() => void load(query)}
          className="raised raised-soft ml-auto inline-flex h-9 items-center gap-1.5 rounded-md bg-background px-3 text-foreground text-sm"
        >
          <RefreshCw className={cn('size-3.5', loading && 'motion-safe:animate-spin')} />
          <span className="hidden sm:inline">Refresh</span>
        </button>
      </div>

      <DataTable
        columns={columns}
        data={events}
        getRowId={(event) => event.id}
        isLoading={loading && !lastGood}
        skeletonRowCount={10}
        errorBanner={
          bannerError && lastGood ? (
            <div className="mb-3 flex items-center justify-between gap-3 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-destructive text-sm">
              <span>Couldn't refresh the stream — showing the last events you loaded.</span>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => void load(query)}
                  className="font-medium underline"
                >
                  Retry
                </button>
                <button
                  type="button"
                  onClick={() => setBannerError(false)}
                  aria-label="Dismiss"
                  className="text-destructive/70 hover:text-destructive"
                >
                  ×
                </button>
              </div>
            </div>
          ) : undefined
        }
        emptyState={{
          icon: <SearchX className="size-5" />,
          title: 'Nothing in the stream',
          description: 'No events have flowed through this window yet.',
        }}
      />

      {events.length > 0 && (
        <DataTablePagination
          pageSize={query.pageSize}
          onPageSizeChange={(size) => void load({ ...query, pageSize: size, page: 0 })}
          hasPrev={query.page > 0}
          hasNext={hasMore}
          onPrev={() => void load({ ...query, page: Math.max(0, query.page - 1) })}
          onNext={() => void load({ ...query, page: query.page + 1 })}
        />
      )}
    </div>
  );
}
