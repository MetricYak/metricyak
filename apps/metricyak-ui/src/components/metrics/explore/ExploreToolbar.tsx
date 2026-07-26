import { Check, ChevronDown, GitCompareArrows, SlidersHorizontal, Split } from 'lucide-react';
import { DropdownMenu } from 'radix-ui';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { Metric } from '@/api/metrics';
import { TimeRangeSelect } from '@/components/activity/TimeRangeSelect';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { cn } from '@/lib/utils';
import { AddFilterPopover } from './AddFilterPopover';
import type { ExploreFilter, ExploreState } from './explore-url';
import { FilterChips } from './FilterChips';
import { EXPLORE_TIME_RANGES } from './granularity';
import { MetricPicker } from './MetricPicker';
import { TOOLBAR_CONTROL } from './toolbar-control';

const SPLIT_NONE = 'none';

interface ExploreToolbarProps {
  projectId: string;
  metrics: readonly Metric[];
  metric: Metric | null;
  state: ExploreState;
  window: { from: string; to: string };
  catalogueHref: string;
  onChange: (next: ExploreState) => void;
}

function SplitBySelect({
  dimensions,
  value,
  disabled,
  disabledReason,
  onChange,
}: {
  dimensions: readonly string[];
  value: string | null;
  disabled: boolean;
  disabledReason: string;
  onChange: (next: string | null) => void;
}): React.JSX.Element {
  const [open, setOpen] = useState(false);

  return (
    <DropdownMenu.Root open={open} onOpenChange={setOpen}>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          disabled={disabled}
          title={disabled ? disabledReason : undefined}
          aria-label={value ? `Split by ${value}` : 'Split by'}
          className={cn(TOOLBAR_CONTROL, value && 'text-brand-orange-text')}
        >
          <Split className="size-4 shrink-0 text-muted-foreground" />
          <span className="max-w-32 truncate font-medium">
            {value ? `Split: ${value}` : 'Split by'}
          </span>
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
          className="dropdown-content min-w-44 overflow-y-auto rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-xl"
          style={{ zIndex: 'var(--z-popover)' }}
        >
          <DropdownMenu.RadioGroup
            value={value ?? SPLIT_NONE}
            onValueChange={(next) => onChange(next === SPLIT_NONE ? null : next)}
          >
            {[SPLIT_NONE, ...dimensions].map((option) => (
              <DropdownMenu.RadioItem
                key={option}
                value={option}
                className="relative flex cursor-pointer select-none items-center rounded-[5px] py-1.5 pr-3 pl-7 text-sm outline-none transition-colors data-[state=checked]:font-semibold data-highlighted:bg-metricyak-100"
              >
                <DropdownMenu.ItemIndicator className="absolute left-2 inline-flex">
                  <Check className="size-3.5 text-metricyak-brand-orange" />
                </DropdownMenu.ItemIndicator>
                {option === SPLIT_NONE ? 'No split' : option}
              </DropdownMenu.RadioItem>
            ))}
          </DropdownMenu.RadioGroup>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

function CompareToggle({
  active,
  disabled,
  disabledReason,
  onToggle,
}: {
  active: boolean;
  disabled: boolean;
  disabledReason: string;
  onToggle: () => void;
}): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      aria-pressed={active}
      title={disabled ? disabledReason : 'Overlay the previous period'}
      className={cn(TOOLBAR_CONTROL, active && 'text-brand-orange-text')}
    >
      <GitCompareArrows className="size-4 shrink-0 text-muted-foreground" />
      <span className="font-medium">Compare</span>
    </button>
  );
}

export function ExploreToolbar({
  projectId,
  metrics,
  metric,
  state,
  window,
  catalogueHref,
  onChange,
}: ExploreToolbarProps): React.JSX.Element {
  const isDesktop = useMediaQuery('(min-width: 768px)');
  const [refineOpen, setRefineOpen] = useState(false);

  const dimensions = metric?.definition.dimensions ?? [];
  const hasDimensions = dimensions.length > 0;

  const setFilters = (filters: readonly ExploreFilter[]): void => {
    onChange({ ...state, filters, selection: null });
  };

  const refineControls = hasDimensions ? (
    <>
      <SplitBySelect
        dimensions={dimensions}
        value={state.splitBy}
        disabled={state.compare}
        disabledReason="Turn off Compare to split this metric"
        onChange={(splitBy) => onChange({ ...state, splitBy, selection: null })}
      />
      <CompareToggle
        active={state.compare}
        disabled={state.splitBy !== null}
        disabledReason="Clear the split to compare periods"
        onToggle={() => onChange({ ...state, compare: !state.compare, selection: null })}
      />
      {metric ? (
        <AddFilterPopover
          projectId={projectId}
          metricId={metric.id}
          dimensions={dimensions}
          from={window.from}
          to={window.to}
          onAdd={(filter) => {
            setFilters([...state.filters, filter]);
            setRefineOpen(false);
          }}
        />
      ) : null}
    </>
  ) : (
    <CompareToggle
      active={state.compare}
      disabled={false}
      disabledReason=""
      onToggle={() => onChange({ ...state, compare: !state.compare, selection: null })}
    />
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <MetricPicker
          metrics={metrics}
          selectedId={metric?.id ?? null}
          onSelect={(metricId) =>
            onChange({ ...state, metricId, splitBy: null, filters: [], selection: null })
          }
        />
        <TimeRangeSelect
          value={state.range}
          options={EXPLORE_TIME_RANGES}
          onChange={(range) => onChange({ ...state, range, granularity: null, selection: null })}
        />

        {isDesktop ? (
          refineControls
        ) : (
          <Popover open={refineOpen} onOpenChange={setRefineOpen}>
            <PopoverTrigger asChild>
              <button type="button" className={TOOLBAR_CONTROL}>
                <SlidersHorizontal className="size-4 shrink-0 text-muted-foreground" />
                <span className="font-medium">Refine</span>
              </button>
            </PopoverTrigger>
            <PopoverContent align="start" className="flex w-auto flex-col items-stretch gap-2 p-2">
              {refineControls}
            </PopoverContent>
          </Popover>
        )}
      </div>

      {hasDimensions ? (
        <FilterChips
          filters={state.filters}
          onRemove={(index) => setFilters(state.filters.filter((_, at) => at !== index))}
        />
      ) : metric ? (
        <p className="text-muted-foreground text-xs">
          Add dimensions to this metric to filter and split it.{' '}
          <Link
            to={catalogueHref}
            className="text-brand-orange-text underline-offset-4 hover:underline"
          >
            Edit {metric.name}
          </Link>
        </p>
      ) : null}
    </div>
  );
}
