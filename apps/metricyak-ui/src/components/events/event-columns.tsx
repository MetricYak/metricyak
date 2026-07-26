import type { ColumnDef } from '@tanstack/react-table';
import type { ReactNode } from 'react';
import type { RealEvent } from '@/api/events';
import { formatCompact, formatPropertyValue } from '@/components/activity/format';

const PROPERTIES_PREVIEW_LIMIT = 6;

export function PropertiesPreviewCell({
  properties,
}: {
  properties: Record<string, unknown>;
}): React.JSX.Element {
  const entries = Object.entries(properties);
  const preview = entries.slice(0, PROPERTIES_PREVIEW_LIMIT);
  const overflow = entries.length - preview.length;

  return (
    <span className="flex items-center gap-4 font-mono text-[12px] text-muted-foreground">
      {preview.map(([key, value]) => (
        <span key={key} className="truncate">
          <span className="text-metricyak-500">{key}</span>
          <span className="text-metricyak-400">=</span>
          <span className="text-metricyak-700">{formatPropertyValue(value)}</span>
        </span>
      ))}
      {overflow > 0 && <span className="text-metricyak-400">+{overflow}</span>}
    </span>
  );
}

export function eventColumns(timeHeader: ReactNode): ColumnDef<RealEvent, unknown>[] {
  return [
    {
      id: 'time',
      header: () => timeHeader,
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
  ];
}
