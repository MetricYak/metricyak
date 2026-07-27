import { X } from 'lucide-react';
import type { ExploreFilter } from './explore-url';

interface FilterChipsProps {
  filters: readonly ExploreFilter[];
  onRemove: (index: number) => void;
}

export function FilterChips({ filters, onRemove }: FilterChipsProps): React.JSX.Element | null {
  if (filters.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {filters.map((filter, index) => (
        <button
          key={`${filter.name}:${filter.value}`}
          type="button"
          onClick={() => onRemove(index)}
          className="group inline-flex h-7 items-center gap-1.5 rounded-full border border-primary/40 bg-primary/10 pr-1.5 pl-2.5 text-brand-orange-text text-xs transition-colors hover:bg-primary/20"
        >
          <span className="font-medium">
            {filter.name} = {filter.value}
          </span>
          <X className="size-3.5 opacity-60 transition-opacity group-hover:opacity-100" />
          <span className="sr-only">
            Remove filter {filter.name} equals {filter.value}
          </span>
        </button>
      ))}
    </div>
  );
}
