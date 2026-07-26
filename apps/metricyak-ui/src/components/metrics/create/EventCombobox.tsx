import { Check, ChevronsUpDown } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { listRecentEventNames } from '@/api/events';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useProjectContext } from '@/contexts/ProjectContext';
import { cn } from '@/lib/utils';

export interface RecentlySeenEvents {
  names: string[];
  loading: boolean;
  failed: boolean;
}

export function useRecentlySeenEvents(): RecentlySeenEvents {
  const { activeProject } = useProjectContext();
  const [names, setNames] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!activeProject) return;
    let cancelled = false;
    setLoading(true);
    setFailed(false);
    listRecentEventNames(activeProject.id)
      .then((recentNames) => {
        if (cancelled) return;
        setNames(recentNames);
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setNames([]);
        setFailed(true);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activeProject]);

  return { names, loading, failed };
}

interface EventComboboxProps {
  value: string;
  onSelect: (name: string) => void;
  placeholder?: string;
}

export function EventCombobox({
  value,
  onSelect,
  placeholder = 'Pick or type an event',
}: EventComboboxProps): React.JSX.Element {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const { names } = useRecentlySeenEvents();

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return names;
    return names.filter((name) => name.toLowerCase().includes(needle));
  }, [names, search]);

  const exactMatch = names.includes(search.trim());

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full min-w-56 justify-between font-normal"
        >
          <span className={cn('truncate', !value && 'text-muted-foreground')}>
            {value || placeholder}
          </span>
          <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-(--radix-popover-trigger-width) p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search recent activity…"
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            <CommandEmpty className="px-3 py-4 text-left text-muted-foreground text-xs">
              {search.trim()
                ? 'No event by that name yet.'
                : "No events seen here yet — type the name you send from your app (e.g. checkout.completed) and we'll match it once it arrives."}
            </CommandEmpty>
            {filtered.length > 0 ? (
              <CommandGroup heading="From your recent activity">
                {filtered.map((name) => (
                  <CommandItem
                    key={name}
                    value={name}
                    onSelect={() => {
                      onSelect(name);
                      setSearch('');
                      setOpen(false);
                    }}
                  >
                    <Check className={cn('size-4', value === name ? 'opacity-100' : 'opacity-0')} />
                    <span className="flex-1 truncate">{name}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            ) : null}
            {search.trim() && !exactMatch ? (
              <CommandGroup heading="Custom">
                <CommandItem
                  value={search}
                  onSelect={() => {
                    onSelect(search.trim());
                    setSearch('');
                    setOpen(false);
                  }}
                >
                  Use "{search.trim()}"
                </CommandItem>
              </CommandGroup>
            ) : null}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
