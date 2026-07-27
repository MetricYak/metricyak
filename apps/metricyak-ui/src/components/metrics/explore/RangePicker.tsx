import { Calendar, Check, ChevronDown } from 'lucide-react';
import { useState } from 'react';
import { timeRangeLabel } from '@/api/events';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import type { ExploreWindow } from './explore-url';
import { EXPLORE_TIME_RANGES } from './granularity';
import { TOOLBAR_CONTROL } from './toolbar-control';

const SPAN_FORMAT = new Intl.DateTimeFormat(undefined, {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

export function windowLabel(window: ExploreWindow): string {
  if (window.kind === 'preset') return timeRangeLabel(window.range);
  return `${SPAN_FORMAT.format(window.fromMs)} – ${SPAN_FORMAT.format(window.toMs)}`;
}

function toLocalInput(atMs: number): string {
  const at = new Date(atMs - new Date(atMs).getTimezoneOffset() * 60_000);
  return at.toISOString().slice(0, 16);
}

function fromLocalInput(raw: string): number | null {
  const parsed = new Date(raw).getTime();
  return Number.isNaN(parsed) ? null : parsed;
}

interface RangePickerProps {
  window: ExploreWindow;
  resolved: { fromMs: number; toMs: number };
  onChange: (next: ExploreWindow) => void;
}

export function RangePicker({ window, resolved, onChange }: RangePickerProps): React.JSX.Element {
  const [open, setOpen] = useState(false);
  const [customFrom, setCustomFrom] = useState(() => toLocalInput(resolved.fromMs));
  const [customTo, setCustomTo] = useState(() => toLocalInput(resolved.toMs));

  const fromMs = fromLocalInput(customFrom);
  const toMs = fromLocalInput(customTo);
  const customValid = fromMs !== null && toMs !== null && toMs > fromMs;

  const applyCustom = (): void => {
    if (fromMs === null || toMs === null || toMs <= fromMs) return;
    onChange({ kind: 'custom', fromMs, toMs });
    setOpen(false);
  };

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          setCustomFrom(toLocalInput(resolved.fromMs));
          setCustomTo(toLocalInput(resolved.toMs));
        }
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`Time range: ${windowLabel(window)}`}
          className={cn(TOOLBAR_CONTROL, 'font-medium')}
        >
          <Calendar className="size-4 shrink-0 text-muted-foreground" />
          <span className="truncate">{windowLabel(window)}</span>
          <ChevronDown
            aria-hidden="true"
            className={cn(
              'size-4 shrink-0 text-muted-foreground transition-transform duration-150',
              open && 'rotate-180',
            )}
          />
        </button>
      </PopoverTrigger>

      <PopoverContent align="start" className="w-72 p-0">
        <ul className="max-h-[60vh] overflow-y-auto p-1">
          {EXPLORE_TIME_RANGES.map((option) => {
            const active = window.kind === 'preset' && window.range === option.id;
            return (
              <li key={option.id}>
                <button
                  type="button"
                  onClick={() => {
                    onChange({ kind: 'preset', range: option.id });
                    setOpen(false);
                  }}
                  className={cn(
                    'flex w-full items-center gap-2 rounded-[5px] py-1.5 pr-3 pl-2 text-left text-sm transition-colors hover:bg-metricyak-100',
                    active && 'font-semibold',
                  )}
                >
                  <Check
                    aria-hidden="true"
                    className={cn(
                      'size-3.5 shrink-0 text-metricyak-brand-orange',
                      active ? 'opacity-100' : 'opacity-0',
                    )}
                  />
                  {option.label}
                </button>
              </li>
            );
          })}
        </ul>

        <div className="flex flex-col gap-2 border-border border-t p-3">
          <p className="font-medium text-xs">Custom range</p>
          <label className="flex flex-col gap-1 text-muted-foreground text-xs">
            From
            <input
              type="datetime-local"
              value={customFrom}
              onChange={(event) => setCustomFrom(event.target.value)}
              className="h-8 rounded-md border border-input bg-background px-2 text-foreground text-sm outline-none ring-ring focus-visible:ring-2"
            />
          </label>
          <label className="flex flex-col gap-1 text-muted-foreground text-xs">
            To
            <input
              type="datetime-local"
              value={customTo}
              onChange={(event) => setCustomTo(event.target.value)}
              className="h-8 rounded-md border border-input bg-background px-2 text-foreground text-sm outline-none ring-ring focus-visible:ring-2"
            />
          </label>
          {customValid ? null : (
            <p className="text-destructive text-xs">Pick an end time after the start time.</p>
          )}
          <Button size="sm" disabled={!customValid} onClick={applyCustom} className="raised mt-1">
            Apply range
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
