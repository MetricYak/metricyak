import { Check, ChevronsUpDown } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { Metric } from '@/api/metrics';
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { TOOLBAR_CONTROL } from './toolbar-control';

interface MetricPickerProps {
  metrics: readonly Metric[];
  selectedId: string | null;
  onSelect: (metricId: string) => void;
}

export function MetricPicker({
  metrics,
  selectedId,
  onSelect,
}: MetricPickerProps): React.JSX.Element {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const selected = metrics.find((metric) => metric.id === selectedId) ?? null;

  const matches = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return metrics;
    return metrics.filter((metric) => metric.name.toLowerCase().includes(needle));
  }, [metrics, search]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          role="combobox"
          aria-expanded={open}
          aria-label={selected ? `Metric: ${selected.name}` : 'Choose a metric'}
          className={cn(TOOLBAR_CONTROL, 'max-w-64 min-w-40 justify-between font-medium')}
        >
          <span className={cn('truncate', !selected && 'font-normal text-muted-foreground')}>
            {selected ? selected.name : 'Choose a metric'}
          </span>
          <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-0">
        <Command shouldFilter={false}>
          <CommandInput placeholder="Search metrics…" value={search} onValueChange={setSearch} />
          <CommandList>
            <CommandEmpty className="px-3 py-4 text-left text-muted-foreground text-xs">
              No metric by that name.
            </CommandEmpty>
            {matches.map((metric) => (
              <CommandItem
                key={metric.id}
                value={metric.id}
                onSelect={() => {
                  onSelect(metric.id);
                  setSearch('');
                  setOpen(false);
                }}
              >
                <Check
                  className={cn(
                    'size-4 text-metricyak-brand-orange',
                    metric.id === selectedId ? 'opacity-100' : 'opacity-0',
                  )}
                />
                <span className="flex-1 truncate">{metric.name}</span>
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
