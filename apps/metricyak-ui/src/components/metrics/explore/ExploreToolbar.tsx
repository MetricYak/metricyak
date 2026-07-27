import { Link } from 'react-router-dom';
import { AddFilterPopover } from './AddFilterPopover';
import type { ExploreMetric } from './explore-model';
import type { ExploreFilter, ExploreWindow } from './explore-url';
import { FilterChips } from './FilterChips';
import { GranularitySelect } from './GranularitySelect';
import type { Granularity } from './granularity';
import { MetricPicker } from './MetricPicker';
import { RangePicker } from './RangePicker';

interface ExploreToolbarProps {
  metrics: readonly ExploreMetric[];
  metric: ExploreMetric | null;
  window: ExploreWindow;
  resolvedWindow: { fromMs: number; toMs: number };
  granularity: Granularity | null;
  resolvedGranularity: Granularity;
  granularityChoices: readonly Granularity[];
  filters: readonly ExploreFilter[];
  freshness: string;
  catalogueHref: string;
  loadDimensionValues: (dimension: string) => Promise<readonly string[]>;
  onSelectMetric: (metricId: string) => void;
  onChangeWindow: (next: ExploreWindow) => void;
  onChangeGranularity: (next: Granularity | null) => void;
  onChangeFilters: (next: readonly ExploreFilter[]) => void;
}

export function ExploreToolbar({
  metrics,
  metric,
  window,
  resolvedWindow,
  granularity,
  resolvedGranularity,
  granularityChoices,
  filters,
  freshness,
  catalogueHref,
  loadDimensionValues,
  onSelectMetric,
  onChangeWindow,
  onChangeGranularity,
  onChangeFilters,
}: ExploreToolbarProps): React.JSX.Element {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div className="flex min-w-0 flex-col gap-1.5">
          <MetricPicker
            metrics={metrics}
            selectedId={metric?.id ?? null}
            variant="heading"
            onSelect={onSelectMetric}
          />
          {metric ? (
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-muted-foreground text-xs">
              <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-foreground">
                {metric.expression}
              </code>
              <span>{freshness}</span>
              <Link
                to={catalogueHref}
                className="text-brand-orange-text underline-offset-4 hover:underline"
              >
                Edit definition
              </Link>
            </div>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <RangePicker window={window} resolved={resolvedWindow} onChange={onChangeWindow} />
          <GranularitySelect
            value={granularity}
            resolved={resolvedGranularity}
            choices={granularityChoices}
            onChange={onChangeGranularity}
          />
          {metric && metric.dimensions.length > 0 ? (
            <AddFilterPopover
              dimensions={metric.dimensions}
              loadValues={loadDimensionValues}
              onAdd={(filter) => onChangeFilters([...filters, filter])}
            />
          ) : null}
        </div>
      </div>

      <FilterChips
        filters={filters}
        onRemove={(index) => onChangeFilters(filters.filter((_, at) => at !== index))}
      />
    </div>
  );
}
