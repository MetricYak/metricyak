import { Check, ChevronDown, Clock } from 'lucide-react';
import { DropdownMenu } from 'radix-ui';
import { useState } from 'react';
import { TIME_RANGES, type TimeRange, timeRangeLabel } from '@/api/events';
import { cn } from '@/lib/utils';

interface TimeRangeSelectProps {
  value: TimeRange;
  onChange: (range: TimeRange) => void;
}

export function TimeRangeSelect({ value, onChange }: TimeRangeSelectProps): React.JSX.Element {
  const [open, setOpen] = useState(false);

  return (
    <DropdownMenu.Root open={open} onOpenChange={setOpen}>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          aria-label={`Time range: ${timeRangeLabel(value)}`}
          className="raised raised-soft inline-flex h-9 items-center gap-1.5 rounded-md bg-background pr-2 pl-2.5 text-foreground text-sm"
        >
          <Clock className="size-4 shrink-0 text-muted-foreground" />
          <span className="font-medium">{timeRangeLabel(value)}</span>
          <ChevronDown
            className={cn(
              'size-4 shrink-0 text-muted-foreground transition-transform duration-150',
              open && 'rotate-180',
            )}
          />
        </button>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="start"
          sideOffset={8}
          className="dropdown-content overflow-y-auto rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-xl"
          style={{
            zIndex: 'var(--z-popover)',
            minWidth: 'var(--radix-dropdown-menu-trigger-width)',
            maxHeight: 'min(17rem, var(--radix-dropdown-menu-content-available-height))',
            transformOrigin: 'var(--radix-dropdown-menu-content-transform-origin)',
          }}
        >
          <DropdownMenu.RadioGroup value={value} onValueChange={(v) => onChange(v as TimeRange)}>
            {TIME_RANGES.map((option) => (
              <DropdownMenu.RadioItem
                key={option.id}
                value={option.id}
                className={cn(
                  'relative flex cursor-pointer select-none items-center rounded-[5px] py-1.5 pr-3 pl-7 font-medium text-sm outline-none',
                  'text-foreground transition-colors data-highlighted:bg-metricyak-100',
                  'data-[state=checked]:font-semibold',
                )}
              >
                <DropdownMenu.ItemIndicator className="absolute left-2 inline-flex">
                  <Check className="size-3.5 text-metricyak-brand-orange" />
                </DropdownMenu.ItemIndicator>
                {option.label}
              </DropdownMenu.RadioItem>
            ))}
          </DropdownMenu.RadioGroup>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
