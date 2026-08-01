import type { ColumnDef } from '@tanstack/react-table';
import { Rocket, SearchX, Trash2 } from 'lucide-react';
import { useMemo } from 'react';
import type { SignalSource } from '@/api/signal-sources';
import {
  deriveSourceStatus,
  formatLastDelivery,
  type SourceStatusTone,
} from '@/components/data/deployment-source-view';
import { ProviderMark, providerLabel } from '@/components/data/ProviderMark';
import { DataTable } from '@/components/data-table/DataTable';
import { Button } from '@/components/ui/button';

const DOT_CLASS: Record<SourceStatusTone, string> = {
  ok: 'bg-emerald-500',
  pending: 'bg-amber-500',
  error: 'bg-destructive',
};

function SourceStatus({ status }: { status: SignalSource['status'] }): React.JSX.Element {
  const view = deriveSourceStatus(status);
  return (
    <span className="flex items-center gap-2">
      <span className={`size-2 flex-none rounded-full ${DOT_CLASS[view.tone]}`} />
      <span className="font-medium text-sm">{view.label}</span>
    </span>
  );
}

function buildColumns(
  now: Date,
  onDelete: (source: SignalSource) => void,
): ColumnDef<SignalSource, unknown>[] {
  return [
    {
      id: 'name',
      header: 'Name',
      cell: ({ row }) => (
        <div className="flex items-center gap-3">
          <span className="flex size-8 flex-none items-center justify-center rounded-md border border-border">
            <ProviderMark provider={row.original.provider} className="size-4 opacity-85" />
          </span>
          <div className="min-w-0">
            <div className="truncate font-medium text-sm">{row.original.name}</div>
            <div className="text-muted-foreground text-xs">
              {providerLabel(row.original.provider)}
            </div>
          </div>
        </div>
      ),
    },
    {
      id: 'status',
      header: 'Status',
      cell: ({ row }) => <SourceStatus status={row.original.status} />,
      meta: { className: 'w-56' },
    },
    {
      id: 'lastDelivery',
      header: 'Last deploy',
      cell: ({ row }) => (
        <span className="text-muted-foreground text-sm">
          {formatLastDelivery(row.original.lastDeliveryAt, now)}
        </span>
      ),
      meta: { className: 'w-44' },
    },
    {
      id: 'actions',
      header: () => <span className="sr-only">Actions</span>,
      cell: ({ row }) => (
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={`Delete ${row.original.name}`}
          onClick={() => onDelete(row.original)}
        >
          <Trash2 className="size-4" />
        </Button>
      ),
      meta: { className: 'w-16 text-right' },
    },
  ];
}

interface DeploymentSourcesTableProps {
  sources: readonly SignalSource[];
  filtersActive: boolean;
  isLoading: boolean;
  now: Date;
  onDelete: (source: SignalSource) => void;
}

export function DeploymentSourcesTable({
  sources,
  filtersActive,
  isLoading,
  now,
  onDelete,
}: DeploymentSourcesTableProps): React.JSX.Element {
  const columns = useMemo(() => buildColumns(now, onDelete), [now, onDelete]);

  return (
    <DataTable
      columns={columns}
      data={sources}
      getRowId={(source) => source.id}
      minWidthClassName="min-w-0 md:min-w-[40rem]"
      isLoading={isLoading}
      skeletonRowCount={3}
      fill
      emptyState={
        filtersActive
          ? {
              icon: <SearchX className="size-5" />,
              title: 'No sources match',
              description: 'Try a different search or status filter.',
            }
          : {
              icon: <Rocket className="size-5" />,
              title: 'No deployment sources yet',
              description: 'Connected sources and their delivery status will show up here.',
            }
      }
    />
  );
}
