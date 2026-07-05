import { Activity, List, Pause, Play, Radio } from 'lucide-react';
import { LayoutGroup, motion, useReducedMotion } from 'motion/react';
import { useEffect, useState } from 'react';
import { Outlet, useLocation, useNavigate, useOutletContext } from 'react-router-dom';
import { useProjectContext } from '@/contexts/ProjectContext';
import { cn } from '@/lib/utils';
import { EventsExplorer } from './EventsExplorer';
import {
  EventMessageRow,
  EventRow,
  EventSkeletonRows,
  EventTableFrame,
  EventTableHead,
  NewEventsRow,
  TableBody,
} from './EventTable';
import { formatFull, formatRelative } from './format';
import { ThroughputMeter } from './ThroughputMeter';
import { useActivityFeed } from './useActivityFeed';

type View = 'live' | 'explore';

type ActivityOutletContext = {
  feed: ReturnType<typeof useActivityFeed>;
  projectId: string;
};

const TABS: { id: View; label: string; icon: typeof Radio }[] = [
  { id: 'live', label: 'Live', icon: Radio },
  { id: 'explore', label: 'Explore', icon: List },
];

// ─── Underline tabs ─────────────────────────────────────────────────────────────

function TabBar({
  view,
  onChange,
}: {
  view: View;
  onChange: (v: View) => void;
}): React.JSX.Element {
  const reduceMotion = useReducedMotion();
  return (
    <LayoutGroup id="activity-tabs">
      <nav>
        <ul className="flex items-stretch gap-6">
          {TABS.map((tab) => {
            const active = view === tab.id;
            const Icon = tab.icon;
            return (
              <li key={tab.id}>
                <button
                  type="button"
                  onClick={() => onChange(tab.id)}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'relative flex items-center gap-1.5 pt-1 pb-3 font-medium text-sm transition-colors',
                    active ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  <Icon className="size-4" />
                  {tab.label}
                  {active && (
                    <motion.span
                      layoutId="activity-tab-underline"
                      transition={
                        reduceMotion
                          ? { duration: 0 }
                          : { type: 'spring', bounce: 0.2, visualDuration: 0.3 }
                      }
                      className="-bottom-px absolute inset-x-0 h-0.5 rounded-full bg-metricyak-brand-orange"
                    />
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>
    </LayoutGroup>
  );
}

// ─── Live / Pause toggle ────────────────────────────────────────────────────────

function LiveToggle({
  live,
  onToggle,
}: {
  live: boolean;
  onToggle: () => void;
}): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={live}
      className={cn(
        'raised raised-soft inline-flex items-center gap-2 rounded-md bg-background px-3 py-1.5',
        'font-medium text-foreground text-sm',
      )}
    >
      {live ? (
        <span className="relative flex size-2">
          <span className="absolute inline-flex h-full w-full rounded-full bg-metricyak-brand-orange/60 motion-safe:animate-ping motion-reduce:hidden" />
          <span className="relative inline-flex size-2 rounded-full bg-metricyak-brand-orange" />
        </span>
      ) : (
        <span className="size-2 rounded-full bg-metricyak-400" />
      )}
      <span className="tabular-nums">{live ? 'Live' : 'Paused'}</span>
      {live ? (
        <Pause className="size-3.5 text-muted-foreground" />
      ) : (
        <Play className="size-3.5 text-muted-foreground" />
      )}
    </button>
  );
}

function LiveStream({ feed }: { feed: ReturnType<typeof useActivityFeed> }): React.JSX.Element {
  const { items, freshIds, pendingCount, loading, error, reveal } = feed;
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNowMs(Date.now()), 5_000);
    return () => clearInterval(timer);
  }, []);

  const total = items.length;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="px-6 pt-5 pb-8 md:px-8">
          <EventTableFrame>
            <EventTableHead />
            <TableBody>
              <NewEventsRow count={pendingCount} onReveal={reveal} />
              {loading ? (
                <EventSkeletonRows count={10} />
              ) : error ? (
                <EventMessageRow
                  icon={<Radio className="size-5" />}
                  title="Couldn't tune into the stream"
                >
                  We lost the connection to the event pipeline.
                  <button
                    type="button"
                    onClick={feed.reload}
                    className="mt-2 block w-full text-center font-medium text-metricyak-brand-orange text-sm hover:underline"
                  >
                    Try again
                  </button>
                </EventMessageRow>
              ) : total === 0 ? (
                <EventMessageRow
                  icon={<Activity className="size-5" />}
                  title="Nothing grazing through yet"
                  pulse
                >
                  The moment an event lands in this project, it&rsquo;ll show up right here.
                </EventMessageRow>
              ) : (
                items.map((activity) => (
                  <EventRow
                    key={activity.id}
                    event={activity}
                    time={formatRelative(activity.receivedAt, nowMs)}
                    timeTitle={formatFull(activity.receivedAt)}
                    fresh={freshIds.has(activity.id)}
                  />
                ))
              )}
            </TableBody>
          </EventTableFrame>

          {!loading && !error && total > 0 && (
            <p className="mt-3 text-muted-foreground text-xs tabular-nums">
              Showing the latest{' '}
              <span className="font-medium text-foreground">{total.toLocaleString()}</span>{' '}
              {total === 1 ? 'event' : 'events'}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── No project state ───────────────────────────────────────────────────────────

function NoProject(): React.JSX.Element {
  return (
    <div className="flex flex-col items-center rounded-lg border border-border bg-metricyak-50 px-6 py-14 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-metricyak-100 text-muted-foreground">
        <Radio className="size-5" />
      </span>
      <h2 className="mt-4 font-semibold text-foreground text-sm">No project selected</h2>
      <p className="mt-1 max-w-sm text-muted-foreground text-sm">
        Pick a project from the switcher to watch its activity.
      </p>
    </div>
  );
}

// ─── Layout ─────────────────────────────────────────────────────────────────────

export function ActivityPage(): React.JSX.Element {
  const { activeProject } = useProjectContext();
  const projectId = activeProject?.id ?? null;

  const feed = useActivityFeed(projectId);
  const location = useLocation();
  const navigate = useNavigate();
  const view: View = location.pathname.endsWith('/explore') ? 'explore' : 'live';

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <header className="shrink-0 border-border border-b px-6 pt-7 md:px-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="flex items-center gap-2 font-semibold text-foreground text-xl">
              <Activity className="size-5 text-metricyak-brand-orange" />
              Activity
            </h1>
            <p className="mt-1 text-muted-foreground text-sm">
              A live pulse of everything flowing into MetricYak.
            </p>
          </div>
          {view === 'live' && projectId && (
            <div className="flex items-center gap-4">
              <div className="hidden sm:block">
                <ThroughputMeter arrivalsRef={feed.arrivalsRef} live={feed.live} />
              </div>
              <LiveToggle live={feed.live} onToggle={() => feed.setLive(!feed.live)} />
            </div>
          )}
        </div>

        <div className="mt-6">
          <TabBar view={view} onChange={(v) => navigate(`/activity/${v}`)} />
        </div>
      </header>

      {/* Body */}
      {!projectId ? (
        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="px-6 pt-6 pb-8 md:px-8">
            <NoProject />
          </div>
        </div>
      ) : (
        <Outlet context={{ feed, projectId } satisfies ActivityOutletContext} />
      )}
    </div>
  );
}

// ─── Tab routes ───────────────────────────────────────────────────────────────

export function ActivityLiveView(): React.JSX.Element {
  const { feed } = useOutletContext<ActivityOutletContext>();
  return <LiveStream feed={feed} />;
}

export function ActivityExploreView(): React.JSX.Element {
  const { projectId } = useOutletContext<ActivityOutletContext>();
  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="px-6 pt-5 pb-10 md:px-8">
        <EventsExplorer projectId={projectId} />
      </div>
    </div>
  );
}
