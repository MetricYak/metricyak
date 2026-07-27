import { Check, ChevronDown, LayoutGrid } from 'lucide-react';
import { DropdownMenu } from 'radix-ui';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { GRANULARITY_LABEL, type Granularity } from './granularity';
import { TOOLBAR_CONTROL } from './toolbar-control';

const AUTO = 'auto';

interface GranularitySelectProps {
  value: Granularity | null;
  resolved: Granularity;
  choices: readonly Granularity[];
  onChange: (next: Granularity | null) => void;
}

export function GranularitySelect({
  value,
  resolved,
  choices,
  onChange,
}: GranularitySelectProps): React.JSX.Element {
  const [open, setOpen] = useState(false);

  return (
    <DropdownMenu.Root open={open} onOpenChange={setOpen}>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          aria-label={`Bucket size: ${GRANULARITY_LABEL[resolved]}`}
          className={cn(TOOLBAR_CONTROL, 'font-medium')}
        >
          <LayoutGrid aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
          <span className="truncate">{GRANULARITY_LABEL[resolved]}</span>
          <ChevronDown
            aria-hidden="true"
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
          className="dropdown-content min-w-48 rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-xl"
          style={{ zIndex: 'var(--z-popover)' }}
        >
          <DropdownMenu.RadioGroup
            value={value ?? AUTO}
            onValueChange={(next) =>
              onChange(next === AUTO ? null : (choices.find((choice) => choice === next) ?? null))
            }
          >
            <DropdownMenu.RadioItem
              value={AUTO}
              className="relative flex cursor-pointer select-none items-center rounded-[5px] py-1.5 pr-3 pl-7 text-sm outline-none transition-colors data-[state=checked]:font-semibold data-highlighted:bg-metricyak-100"
            >
              <DropdownMenu.ItemIndicator className="absolute left-2 inline-flex">
                <Check aria-hidden="true" className="size-3.5 text-metricyak-brand-orange" />
              </DropdownMenu.ItemIndicator>
              Fit to the range
            </DropdownMenu.RadioItem>
            {choices.map((choice) => (
              <DropdownMenu.RadioItem
                key={choice}
                value={choice}
                className="relative flex cursor-pointer select-none items-center rounded-[5px] py-1.5 pr-3 pl-7 text-sm outline-none transition-colors data-[state=checked]:font-semibold data-highlighted:bg-metricyak-100"
              >
                <DropdownMenu.ItemIndicator className="absolute left-2 inline-flex">
                  <Check aria-hidden="true" className="size-3.5 text-metricyak-brand-orange" />
                </DropdownMenu.ItemIndicator>
                {GRANULARITY_LABEL[choice]}
              </DropdownMenu.RadioItem>
            ))}
          </DropdownMenu.RadioGroup>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
