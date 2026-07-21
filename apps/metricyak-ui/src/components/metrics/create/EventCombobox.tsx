import { Check, ChevronsUpDown } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { listRecentEvents } from '@/api/events';
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

export type SeenEvent = { name: string; source: string };

export interface RecentlySeenEvents {
  events: SeenEvent[];
  loading: boolean;
}

export function useRecentlySeenEvents(): RecentlySeenEvents {
  const { activeProject } = useProjectContext();
  const [events, setEvents] = useState<SeenEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!activeProject) return;
    let cancelled = false;
    setLoading(true);
    listRecentEvents(activeProject.id, 200).then((activities) => {
      if (cancelled) return;
      const seen = new Map<string, SeenEvent>();
      for (const activity of activities) {
        if (!seen.has(activity.name)) {
          seen.set(activity.name, { name: activity.name, source: activity.source });
        }
      }
      setEvents([...seen.values()].sort((a, b) => a.name.localeCompare(b.name)));
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [activeProject]);

  return { events, loading };
}

interface EventComboboxProps {
  value: string;
  onSelect: (event: SeenEvent) => void;
  placeholder?: string;
}

export function EventCombobox({
  value,
  onSelect,
  placeholder = 'Pick or type an event',
}: EventComboboxProps): React.JSX.Element {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const { events } = useRecentlySeenEvents();

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return events;
    return events.filter((event) => event.name.toLowerCase().includes(needle));
  }, [events, search]);

  const exactMatch = events.some((event) => event.name === search.trim());

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
                {filtered.map((event) => (
                  <CommandItem
                    key={event.name}
                    value={event.name}
                    onSelect={() => {
                      onSelect(event);
                      setSearch('');
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={cn('size-4', value === event.name ? 'opacity-100' : 'opacity-0')}
                    />
                    <span className="flex-1 truncate">{event.name}</span>
                    <span className="rounded bg-metricyak-100 px-1.5 py-0.5 text-[11px] text-metricyak-600">
                      {event.source}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            ) : null}
            {search.trim() && !exactMatch ? (
              <CommandGroup heading="Custom">
                <CommandItem
                  value={search}
                  onSelect={() => {
                    onSelect({ name: search.trim(), source: '' });
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
