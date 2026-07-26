import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { useEffect, useState } from 'react';
import { getMetricDimensionValues } from '@/api/metric-series';
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import type { ExploreFilter } from './explore-url';
import { TOOLBAR_CONTROL } from './toolbar-control';

type ValuesState =
  | { kind: 'loading' }
  | { kind: 'ready'; values: readonly string[] }
  | { kind: 'failed' };

interface AddFilterPopoverProps {
  projectId: string;
  metricId: string;
  dimensions: readonly string[];
  from: string;
  to: string;
  onAdd: (filter: ExploreFilter) => void;
}

function ValueList({
  state,
  onRetry,
  onPick,
}: {
  state: ValuesState;
  onRetry: () => void;
  onPick: (value: string) => void;
}): React.JSX.Element {
  switch (state.kind) {
    case 'loading':
      return (
        <div className="space-y-1.5 px-3 py-3">
          {Array.from({ length: 4 }).map((_, index) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: fixed skeleton list
            <div key={index} className="h-4 w-full animate-pulse rounded bg-metricyak-100" />
          ))}
        </div>
      );
    case 'failed':
      return (
        <div className="px-3 py-4 text-xs">
          <p className="text-foreground">Couldn't load values.</p>
          <button
            type="button"
            onClick={onRetry}
            className="mt-1 text-brand-orange-text underline-offset-4 hover:underline"
          >
            Try again
          </button>
        </div>
      );
    case 'ready':
      return (
        <Command shouldFilter>
          <CommandInput placeholder="Search values…" />
          <CommandList>
            <CommandEmpty className="px-3 py-4 text-left text-muted-foreground text-xs">
              Nothing recorded for this dimension in the current window.
            </CommandEmpty>
            {state.values.map((value) => (
              <CommandItem key={value} value={value} onSelect={() => onPick(value)}>
                <span className="flex-1 truncate">{value}</span>
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      );
    default: {
      const _exhaustive: never = state;
      throw new Error(`Unhandled values state: ${JSON.stringify(_exhaustive)}`);
    }
  }
}

export function AddFilterPopover({
  projectId,
  metricId,
  dimensions,
  from,
  to,
  onAdd,
}: AddFilterPopoverProps): React.JSX.Element {
  const [open, setOpen] = useState(false);
  const [dimension, setDimension] = useState<string | null>(null);
  const [state, setState] = useState<ValuesState>({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!dimension) return;
    let cancelled = false;
    setState({ kind: 'loading' });
    getMetricDimensionValues(projectId, metricId, dimension, from, to)
      .then((values) => {
        if (!cancelled) setState({ kind: 'ready', values });
      })
      .catch(() => {
        if (!cancelled) setState({ kind: 'failed' });
      });
    return () => {
      cancelled = true;
    };
  }, [projectId, metricId, dimension, from, to, attempt]);

  const close = (): void => {
    setOpen(false);
    setDimension(null);
  };

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setDimension(null);
      }}
    >
      <PopoverTrigger asChild>
        <button type="button" className={cn(TOOLBAR_CONTROL, 'text-muted-foreground')}>
          <Plus className="size-4" />
          Filter
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-0">
        {dimension === null ? (
          <div className="py-1">
            <p className="px-3 py-1.5 font-medium text-muted-foreground text-xs">Filter by</p>
            {dimensions.map((name) => (
              <button
                key={name}
                type="button"
                onClick={() => setDimension(name)}
                className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-metricyak-100"
              >
                <span className="truncate">{name}</span>
                <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
              </button>
            ))}
          </div>
        ) : (
          <div>
            <button
              type="button"
              onClick={() => setDimension(null)}
              className="flex w-full items-center gap-1.5 border-border border-b px-3 py-2 text-left font-medium text-sm transition-colors hover:bg-metricyak-100"
            >
              <ChevronLeft className="size-4 shrink-0 text-muted-foreground" />
              <span className="truncate">{dimension}</span>
            </button>
            <ValueList
              state={state}
              onRetry={() => setAttempt((count) => count + 1)}
              onPick={(value) => {
                onAdd({ name: dimension, value });
                close();
              }}
            />
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
