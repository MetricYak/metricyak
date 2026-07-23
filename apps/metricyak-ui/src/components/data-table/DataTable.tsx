import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  type RowData,
  useReactTable,
} from '@tanstack/react-table';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';

declare module '@tanstack/react-table' {
  interface ColumnMeta<TData extends RowData, TValue> {
    className?: string;
  }
}

export interface DataTableEmptyState {
  icon: React.ReactNode;
  title: string;
  description?: React.ReactNode;
}

interface DataTableProps<TData> {
  columns: ColumnDef<TData, unknown>[];
  data: readonly TData[];
  getRowId: (row: TData) => string;
  isLoading: boolean;
  skeletonRowCount: number;
  errorBanner?: React.ReactNode;
  emptyState: DataTableEmptyState;
  minWidthClassName?: string;
}

function DataTableSkeletonRows({
  columnCount,
  rowCount,
}: {
  columnCount: number;
  rowCount: number;
}): React.JSX.Element {
  return (
    <>
      {Array.from({ length: rowCount }).map((_, rowIndex) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: fixed skeleton list
        <TableRow key={rowIndex} className="hover:bg-transparent">
          {Array.from({ length: columnCount }).map((_, cellIndex) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: fixed skeleton list
            <TableCell key={cellIndex} className="py-3">
              <div className="h-3.5 w-24 animate-pulse rounded bg-metricyak-100" />
            </TableCell>
          ))}
        </TableRow>
      ))}
    </>
  );
}

function DataTableEmptyRow({
  columnCount,
  emptyState,
}: {
  columnCount: number;
  emptyState: DataTableEmptyState;
}): React.JSX.Element {
  return (
    <TableRow className="hover:bg-transparent">
      <TableCell colSpan={columnCount} className="px-6 py-16 text-center whitespace-normal">
        <span className="relative mx-auto flex size-11 items-center justify-center rounded-full bg-metricyak-100 text-muted-foreground">
          {emptyState.icon}
        </span>
        <p className="mt-3 font-semibold text-foreground text-sm">{emptyState.title}</p>
        {emptyState.description && (
          <div className="mt-1 text-muted-foreground text-sm">{emptyState.description}</div>
        )}
      </TableCell>
    </TableRow>
  );
}

export function DataTable<TData>({
  columns,
  data,
  getRowId,
  isLoading,
  skeletonRowCount,
  errorBanner,
  emptyState,
  minWidthClassName = 'min-w-224',
}: DataTableProps<TData>): React.JSX.Element {
  const table = useReactTable({
    data: Array.from(data),
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
  });
  const columnCount = columns.length;

  return (
    <div>
      {errorBanner}
      <Table
        className={minWidthClassName}
        containerClassName="max-h-[70vh] overflow-auto border border-border bg-background"
      >
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id} className="bg-metricyak-50 hover:bg-metricyak-50">
              {headerGroup.headers.map((header) => (
                <TableHead
                  key={header.id}
                  className={cn(
                    'sticky top-0 z-10 h-10 bg-metricyak-50 text-[11px] text-muted-foreground',
                    header.column.columnDef.meta?.className,
                  )}
                >
                  {header.isPlaceholder
                    ? null
                    : flexRender(header.column.columnDef.header, header.getContext())}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {isLoading ? (
            <DataTableSkeletonRows columnCount={columnCount} rowCount={skeletonRowCount} />
          ) : data.length === 0 ? (
            <DataTableEmptyRow columnCount={columnCount} emptyState={emptyState} />
          ) : (
            table.getRowModel().rows.map((row) => (
              <TableRow key={getRowId(row.original)} className="hover:bg-metricyak-50">
                {row.getVisibleCells().map((cell) => (
                  <TableCell
                    key={cell.id}
                    className={cn('py-3.5', cell.column.columnDef.meta?.className)}
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
