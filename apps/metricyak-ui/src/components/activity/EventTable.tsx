import { ArrowUp } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import type { PlatformActivity } from '@/api/events';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { formatValue } from './format';

export { TableBody };

export const EVENT_COLUMNS = 4;
const PREVIEW_LIMIT = 4;

export function EventTableFrame({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-background">
      <Table className="min-w-140">{children}</Table>
    </div>
  );
}

export function EventTableHead({ time }: { time?: React.ReactNode }): React.JSX.Element {
  return (
    <TableHeader>
      <TableRow className="bg-metricyak-50 hover:bg-metricyak-50">
        <TableHead className="h-11 px-4 text-xs text-muted-foreground">{time ?? 'Time'}</TableHead>
        <TableHead className="h-11 px-4 text-xs text-muted-foreground">Event</TableHead>
        <TableHead className="h-11 px-4 text-xs text-muted-foreground">Source</TableHead>
        <TableHead className="hidden h-11 px-4 text-xs text-muted-foreground md:table-cell">
          Properties
        </TableHead>
      </TableRow>
    </TableHeader>
  );
}

/**
 * A live affordance that sits as the first row of the table body. While events are
 * buffered off-screen it invites the user to fold them in — new events never shove
 * the current view around on their own.
 */
export function NewEventsRow({
  count,
  onReveal,
}: {
  count: number;
  onReveal: () => void;
}): React.JSX.Element {
  const reduceMotion = useReducedMotion();
  return (
    <AnimatePresence initial={false}>
      {count > 0 && (
        <motion.tr
          initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -6 }}
          transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
          className="border-border border-b"
        >
          <TableCell colSpan={EVENT_COLUMNS} className="p-0">
            <button
              type="button"
              onClick={onReveal}
              className={cn(
                'group flex w-full items-center justify-center gap-2.5 px-4 py-2.5',
                'bg-metricyak-brand-orange/[0.07] font-medium text-[13px] transition-colors',
                'hover:bg-metricyak-brand-orange/12',
                'focus-visible:bg-metricyak-brand-orange/[0.14] focus-visible:outline-none',
              )}
            >
              {/* Live pulse — the one spot of orange that signals "fresh" */}
              <span className="relative flex size-2">
                <span className="absolute inline-flex h-full w-full rounded-full bg-metricyak-brand-orange/60 motion-safe:animate-ping motion-reduce:hidden" />
                <span className="relative inline-flex size-2 rounded-full bg-metricyak-brand-orange" />
              </span>
              <ArrowUp className="size-3.5 text-metricyak-brand-orange transition-transform group-hover:-translate-y-0.5" />
              <span className="tabular-nums text-foreground">
                {count.toLocaleString()} new {count === 1 ? 'event' : 'events'}
              </span>
              <span className="text-muted-foreground transition-colors group-hover:text-foreground">
                — show
              </span>
            </button>
          </TableCell>
        </motion.tr>
      )}
    </AnimatePresence>
  );
}

interface EventRowProps {
  event: PlatformActivity;
  time: string;
  timeTitle?: string;
  fresh?: boolean;
}

export function EventRow({
  event,
  time,
  timeTitle,
  fresh = false,
}: EventRowProps): React.JSX.Element {
  const entries = Object.entries(event.properties);
  const preview = entries.slice(0, PREVIEW_LIMIT);
  const overflow = entries.length - preview.length;

  return (
    <TableRow className={cn('hover:bg-metricyak-50', fresh && 'event-row-enter')}>
      <TableCell
        className="py-2.5 pl-4 text-[12px] text-muted-foreground tabular-nums"
        title={timeTitle}
      >
        {time}
      </TableCell>
      <TableCell className="py-2.5">
        <span className="font-medium text-foreground text-sm">{event.name}</span>
      </TableCell>
      <TableCell className="py-2.5">
        <span className="rounded bg-metricyak-100 px-1.5 py-0.5 font-medium text-[11px] text-metricyak-600">
          {event.source ?? 'unknown'}
        </span>
      </TableCell>
      <TableCell className="hidden py-2.5 pr-4 md:table-cell">
        <span className="flex items-center gap-3 font-mono text-[12px] text-muted-foreground">
          {entries.length === 0 && <span className="text-metricyak-400">—</span>}
          {preview.map(([key, value]) => (
            <span key={key} className="truncate">
              <span className="text-metricyak-500">{key}</span>
              <span className="text-metricyak-400">=</span>
              <span className="text-metricyak-700">{formatValue(value)}</span>
            </span>
          ))}
          {overflow > 0 && <span className="text-metricyak-400">+{overflow}</span>}
        </span>
      </TableCell>
    </TableRow>
  );
}

export function EventSkeletonRows({ count = 10 }: { count?: number }): React.JSX.Element {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: fixed skeleton list
        <TableRow key={i} className="hover:bg-transparent">
          <TableCell className="py-3 pl-4">
            <div className="h-3 w-20 animate-pulse rounded bg-metricyak-100" />
          </TableCell>
          <TableCell className="py-3">
            <div className="h-3.5 w-40 animate-pulse rounded bg-metricyak-100" />
          </TableCell>
          <TableCell className="py-3">
            <div className="h-4 w-12 animate-pulse rounded bg-metricyak-100" />
          </TableCell>
          <TableCell className="hidden py-3 pr-4 md:table-cell">
            <div className="h-3 w-48 animate-pulse rounded bg-metricyak-100" />
          </TableCell>
        </TableRow>
      ))}
    </>
  );
}

export function EventMessageRow({
  icon,
  title,
  children,
  pulse,
}: {
  icon: React.ReactNode;
  title: string;
  children?: React.ReactNode;
  pulse?: boolean;
}): React.JSX.Element {
  return (
    <TableRow className="hover:bg-transparent">
      <TableCell colSpan={EVENT_COLUMNS} className="px-6 py-16 text-center whitespace-normal">
        <span className="relative mx-auto flex size-11 items-center justify-center rounded-full bg-metricyak-100 text-muted-foreground">
          {pulse && (
            <span className="absolute inset-0 rounded-full bg-metricyak-brand-orange/15 motion-safe:animate-ping motion-reduce:hidden" />
          )}
          <span className="relative">{icon}</span>
        </span>
        <p className="mt-3 font-semibold text-foreground text-sm">{title}</p>
        {children && <div className="mt-1 text-muted-foreground text-sm">{children}</div>}
      </TableCell>
    </TableRow>
  );
}
