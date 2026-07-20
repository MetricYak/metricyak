import { ChevronLeft, ChevronRight } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export const DATA_TABLE_PAGE_SIZES = [25, 50, 75, 100] as const;
export type DataTablePageSize = (typeof DATA_TABLE_PAGE_SIZES)[number];

interface DataTablePaginationProps {
  pageSize: DataTablePageSize;
  onPageSizeChange: (size: DataTablePageSize) => void;
  hasPrev: boolean;
  hasNext: boolean;
  onPrev: () => void;
  onNext: () => void;
}

export function DataTablePagination({
  pageSize,
  onPageSizeChange,
  hasPrev,
  hasNext,
  onPrev,
  onNext,
}: DataTablePaginationProps): React.JSX.Element {
  return (
    <div className="mt-3 flex items-center justify-between gap-4">
      <Select
        value={String(pageSize)}
        onValueChange={(value) => {
          const size = DATA_TABLE_PAGE_SIZES.find((candidate) => String(candidate) === value);
          if (size) onPageSizeChange(size);
        }}
      >
        <SelectTrigger className="h-9 w-auto text-sm" size="sm">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {DATA_TABLE_PAGE_SIZES.map((size) => (
            <SelectItem key={size} value={String(size)}>
              {size} rows
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={onPrev}
          disabled={!hasPrev}
          className="raised raised-soft inline-flex h-9 items-center gap-1 rounded-md bg-background px-2.5 text-foreground text-sm disabled:cursor-not-allowed"
        >
          <ChevronLeft className="size-4" />
          <span className="hidden sm:inline">Prev</span>
        </button>
        <button
          type="button"
          onClick={onNext}
          disabled={!hasNext}
          className="raised raised-soft inline-flex h-9 items-center gap-1 rounded-md bg-background px-2.5 text-foreground text-sm disabled:cursor-not-allowed"
        >
          <span className="hidden sm:inline">Next</span>
          <ChevronRight className="size-4" />
        </button>
      </div>
    </div>
  );
}
