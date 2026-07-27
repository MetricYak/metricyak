import { Check, ChevronsUpDown } from 'lucide-react';
import { useMemo, useState } from 'react';
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import type { ExploreMetric } from './explore-model';
import { TOOLBAR_CONTROL } from './toolbar-control';

type PickerVariant = 'toolbar' | 'heading';

const TRIGGER_CLASS: Readonly<Record<PickerVariant, string>> = {
  toolbar: cn(TOOLBAR_CONTROL, 'max-w-64 min-w-40 justify-between font-medium'),
  heading:
    'group -ml-1 inline-flex max-w-full items-center gap-2 rounded-md px-1 py-0.5 font-semibold text-foreground text-xl outline-none ring-ring transition-colors hover:bg-accent focus-visible:ring-2 sm:text-2xl',
};

interface MetricPickerProps {
  metrics: readonly ExploreMetric[];
  selectedId: string | null;
  variant?: PickerVariant;
  onSelect: (metricId: string) => void;
}

export function MetricPicker({
  metrics,
  selectedId,
  variant = 'toolbar',
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
          className={TRIGGER_CLASS[variant]}
        >
          <span className={cn('truncate', !selected && 'font-normal text-muted-foreground')}>
            {selected ? selected.name : 'Choose a metric'}
          </span>
          <ChevronsUpDown
            aria-hidden="true"
            className={cn(
              'size-4 shrink-0 text-muted-foreground',
              variant === 'heading' && 'opacity-60 group-hover:opacity-100',
            )}
          />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 p-0">
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
                  aria-hidden="true"
                  className={cn(
                    'size-4 shrink-0 text-metricyak-brand-orange',
                    metric.id === selectedId ? 'opacity-100' : 'opacity-0',
                  )}
                />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate">{metric.name}</span>
                  <span className="truncate font-mono text-[11px] text-muted-foreground">
                    {metric.expression}
                  </span>
                </span>
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
