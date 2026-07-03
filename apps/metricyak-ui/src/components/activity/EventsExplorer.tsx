import { ChevronDown, ChevronLeft, ChevronRight, Inbox, RefreshCw, SearchX } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { type EventQueryResult, type EventSort, queryEvents, type TimeRange } from '@/api/events';
import { cn } from '@/lib/utils';
import {
  EventMessageRow,
  EventRow,
  EventSkeletonRows,
  EventTableFrame,
  EventTableHead,
  TableBody,
} from './EventTable';
import { formatCompact } from './format';
import { TimeRangeSelect } from './TimeRangeSelect';

const PAGE_SIZE = 25;

export function EventsExplorer({ projectId }: { projectId: string }): React.JSX.Element {
  const [range, setRange] = useState<TimeRange>('24h');
  const [sort, setSort] = useState<EventSort>('time-desc');
  const [page, setPage] = useState(0);

  // Reset to page 0 whenever the project changes so stale pagination
  // from a previous project doesn't carry over.
  const prevProjectIdRef = useRef(projectId);
  if (prevProjectIdRef.current !== projectId) {
    prevProjectIdRef.current = projectId;
    setPage(0);
  }

  const [result, setResult] = useState<EventQueryResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const reqRef = useRef(0);

  // biome-ignore lint/correctness/useExhaustiveDependencies: refreshKey is a manual reload trigger
  useEffect(() => {
    const reqId = ++reqRef.current;
    setLoading(true);
    setError(false);
    queryEvents(projectId, { range, sort, page, pageSize: PAGE_SIZE })
      .then((res) => {
        if (reqId !== reqRef.current) return;
        setResult(res);
        setLoading(false);
      })
      .catch(() => {
        if (reqId !== reqRef.current) return;
        setError(true);
        setLoading(false);
      });
  }, [projectId, range, sort, page, refreshKey]);

  const total = result?.total ?? 0;
  const events = result?.events ?? [];
  const start = total === 0 ? 0 : page * PAGE_SIZE + 1;
  const end = Math.min(total, (page + 1) * PAGE_SIZE);
  const hasPrev = page > 0;
  const hasNext = end < total;

  return (
    <div>
      {/* Toolbar */}
      <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-2.5">
        <TimeRangeSelect
          value={range}
          onChange={(r) => {
            setRange(r);
            setPage(0);
          }}
        />
        <button
          type="button"
          onClick={() => setRefreshKey((k) => k + 1)}
          className="raised raised-soft ml-auto inline-flex h-9 items-center gap-1.5 rounded-md bg-background px-3 text-foreground text-sm"
        >
          <RefreshCw className={cn('size-3.5', loading && 'motion-safe:animate-spin')} />
          <span className="hidden sm:inline">Refresh</span>
        </button>
      </div>

      {/* Table */}
      <EventTableFrame>
        <EventTableHead
          time={
            <button
              type="button"
              onClick={() => setSort((s) => (s === 'time-desc' ? 'time-asc' : 'time-desc'))}
              className="inline-flex items-center gap-1 transition-colors hover:text-foreground"
            >
              Time
              <ChevronDown
                className={cn('size-3.5 transition-transform', sort === 'time-asc' && 'rotate-180')}
              />
            </button>
          }
        />
        <TableBody>
          {loading ? (
            <EventSkeletonRows count={10} />
          ) : error ? (
            <EventMessageRow icon={<Inbox className="size-5" />} title="Couldn't load events">
              Something interrupted the query.
              <button
                type="button"
                onClick={() => setRefreshKey((k) => k + 1)}
                className="mt-2 block w-full text-center font-medium text-metricyak-brand-orange text-sm hover:underline"
              >
                Try again
              </button>
            </EventMessageRow>
          ) : events.length === 0 ? (
            <EventMessageRow icon={<SearchX className="size-5" />} title="No events in this window">
              {range === 'all'
                ? 'Events will appear here as they arrive.'
                : 'Try widening the time range.'}
            </EventMessageRow>
          ) : (
            events.map((event) => (
              <EventRow key={event.id} event={event} time={formatCompact(event.receivedAt)} />
            ))
          )}
        </TableBody>
      </EventTableFrame>

      {/* Pagination */}
      {!loading && !error && total > 0 && (
        <div className="mt-3 flex items-center justify-between gap-4">
          <p className="text-muted-foreground text-xs tabular-nums">
            <span className="font-medium text-foreground">
              {start}–{end}
            </span>{' '}
            of <span className="font-medium text-foreground">{total.toLocaleString()}</span> events
          </p>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={!hasPrev}
              className="raised raised-soft inline-flex h-9 items-center gap-1 rounded-md bg-background px-2.5 text-foreground text-sm disabled:cursor-not-allowed"
            >
              <ChevronLeft className="size-4" />
              <span className="hidden sm:inline">Prev</span>
            </button>
            <button
              type="button"
              onClick={() => setPage((p) => (hasNext ? p + 1 : p))}
              disabled={!hasNext}
              className="raised raised-soft inline-flex h-9 items-center gap-1 rounded-md bg-background px-2.5 text-foreground text-sm disabled:cursor-not-allowed"
            >
              <span className="hidden sm:inline">Next</span>
              <ChevronRight className="size-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
