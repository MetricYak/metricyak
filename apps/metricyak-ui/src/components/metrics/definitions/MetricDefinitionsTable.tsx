import { Link } from 'react-router-dom';
import type { Metric } from '@/api/metrics';
import { Table, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { formatDateAgo, summarizeDefinition } from './format';

const COLUMNS = 3;

export function MetricDefinitionsTableFrame({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-background">
      <Table>{children}</Table>
    </div>
  );
}

export function MetricDefinitionsTableHead(): React.JSX.Element {
  return (
    <TableHeader>
      <TableRow className="bg-metricyak-50 hover:bg-metricyak-50">
        <TableHead className="h-10 pl-5 text-[11px] text-muted-foreground">Metric</TableHead>
        <TableHead className="h-10 text-[11px] text-muted-foreground">Measures</TableHead>
        <TableHead className="h-10 pr-5 text-[11px] text-muted-foreground">Created</TableHead>
      </TableRow>
    </TableHeader>
  );
}

export function MetricDefinitionRow({
  metric,
  highlighted,
}: {
  metric: Metric;
  highlighted?: boolean;
}): React.JSX.Element {
  return (
    <TableRow className={cn('hover:bg-metricyak-50', highlighted && 'event-row-enter')}>
      <TableCell className="py-3.5 pl-5">
        <Link
          to={`/metrics/definitions/${metric.id}`}
          className="font-medium text-foreground text-sm hover:text-metricyak-brand-orange hover:underline"
        >
          {metric.name}
        </Link>
        {metric.description ? (
          <p className="mt-1 line-clamp-1 text-muted-foreground text-xs">{metric.description}</p>
        ) : null}
      </TableCell>
      <TableCell className="py-3.5 text-muted-foreground text-sm">
        {summarizeDefinition(metric.definition)}
      </TableCell>
      <TableCell className="py-3.5 pr-5 text-muted-foreground text-sm tabular-nums">
        {formatDateAgo(metric.createdAt)}
      </TableCell>
    </TableRow>
  );
}

export function MetricDefinitionsSkeletonRows({
  count = 5,
}: {
  count?: number;
}): React.JSX.Element {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: fixed skeleton list
        <TableRow key={i} className="hover:bg-transparent">
          <TableCell className="py-4 pl-5">
            <div className="h-3.5 w-40 animate-pulse rounded bg-metricyak-100" />
          </TableCell>
          <TableCell className="py-4">
            <div className="h-3 w-32 animate-pulse rounded bg-metricyak-100" />
          </TableCell>
          <TableCell className="py-4 pr-5">
            <div className="h-3 w-16 animate-pulse rounded bg-metricyak-100" />
          </TableCell>
        </TableRow>
      ))}
    </>
  );
}

export function MetricDefinitionsMessageRow({
  title,
  children,
}: {
  title: string;
  children?: React.ReactNode;
}): React.JSX.Element {
  return (
    <TableRow className="hover:bg-transparent">
      <TableCell colSpan={COLUMNS} className="px-6 py-16 text-center whitespace-normal">
        <p className="font-semibold text-foreground text-sm">{title}</p>
        {children && <div className="mt-1 text-muted-foreground text-sm">{children}</div>}
      </TableCell>
    </TableRow>
  );
}
