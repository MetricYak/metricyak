import { Filter } from 'lucide-react';
import { cn } from '@/lib/utils';
import { largestChange } from './breakdown';
import type { BreakdownRow, ValueFormat } from './explore-model';
import type { ExploreFilter } from './explore-url';
import {
  CHANGE_DIRECTION_FILL,
  type ChangeDirection,
  changeDirection,
  formatAbsoluteChange,
  formatChangeRatio,
  formatMetricAmount,
} from './value-format';

const CENTER_PERCENT = 50;
const MIN_BAR_PERCENT = 0.8;
const MISSING = '—';
const MINUS = '−';

function formatShare(share: number | null): string {
  if (share === null) return MISSING;
  const percent = Math.round(share * 100);
  return percent < 0 ? `${MINUS}${-percent}%` : `${percent}%`;
}

function directionOf(row: BreakdownRow): ChangeDirection {
  if (row.changeRatio !== null) return changeDirection(row.changeRatio);
  if (row.change === null || row.change === 0) return 'flat';
  return row.change > 0 ? 'up' : 'down';
}

function changeLabelOf(row: BreakdownRow, valueFormat: ValueFormat): string {
  if (row.change === null) return 'No comparable prior value';
  if (row.changeRatio === null) {
    return `${formatAbsoluteChange(row.change, valueFormat)} versus the prior window`;
  }
  return `${formatChangeRatio(row.changeRatio)} versus the prior window`;
}

function ChangeBar({
  change,
  direction,
  widest,
  label,
}: {
  change: number | null;
  direction: ChangeDirection;
  widest: number;
  label: string;
}): React.JSX.Element {
  const share = change === null || widest === 0 ? 0 : Math.abs(change) / widest;
  const width = Math.max(share * CENTER_PERCENT, MIN_BAR_PERCENT);
  const negative = (change ?? 0) < 0;
  return (
    <div className="relative h-2.5 rounded-full bg-chart-grid" role="img" aria-label={label}>
      <span className="absolute inset-y-0 left-1/2 w-px bg-border" />
      {change === null ? null : (
        <span
          className="absolute top-0 h-2.5 rounded-full"
          style={{
            left: negative ? `${CENTER_PERCENT - width}%` : `${CENTER_PERCENT}%`,
            width: `${width}%`,
            background: CHANGE_DIRECTION_FILL[direction],
          }}
        />
      )}
    </div>
  );
}

interface PropertyBreakdownProps {
  dimensions: readonly string[];
  dimension: string | null;
  valueFormat: ValueFormat;
  rows: readonly BreakdownRow[];
  showShareOfChange: boolean;
  filters: readonly ExploreFilter[];
  loading: boolean;
  onSelectDimension: (name: string) => void;
  onFilterTo: (filter: ExploreFilter) => void;
}

export function PropertyBreakdown({
  dimensions,
  dimension,
  valueFormat,
  rows,
  showShareOfChange,
  filters,
  loading,
  onSelectDimension,
  onFilterTo,
}: PropertyBreakdownProps): React.JSX.Element {
  if (dimensions.length === 0) {
    return (
      <div className="flex flex-col items-center gap-1 py-12 text-center">
        <p className="font-semibold text-foreground text-sm">This metric has no dimensions</p>
        <p className="max-w-sm text-muted-foreground text-sm">
          Add dimensions to the metric definition to break its movement down by property.
        </p>
      </div>
    );
  }

  const widest = largestChange(rows);
  const filtered = new Set(
    filters.filter((filter) => filter.name === dimension).map((filter) => filter.value),
  );

  return (
    <div className="flex flex-col gap-4 p-4 sm:p-5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-muted-foreground text-xs">Group by property</span>
        {dimensions.map((name) => {
          const active = name === dimension;
          return (
            <button
              key={name}
              type="button"
              onClick={() => onSelectDimension(name)}
              aria-pressed={active}
              className={cn(
                'rounded-full border px-2.5 py-1 font-mono text-xs outline-none ring-ring transition-colors focus-visible:ring-2',
                active
                  ? 'border-transparent bg-primary text-primary-foreground'
                  : 'border-border bg-chart-inset text-foreground hover:bg-accent',
              )}
            >
              {name}
            </button>
          );
        })}
      </div>

      {loading && rows.length === 0 ? (
        <p className="py-8 text-center text-muted-foreground text-sm">Loading the breakdown…</p>
      ) : rows.length === 0 ? (
        <p className="py-8 text-center text-muted-foreground text-sm">
          Nothing recorded for {dimension ?? 'this property'} in the selected window.
        </p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-border border-b text-muted-foreground text-xs">
              <th scope="col" className="pb-2 text-left font-normal">
                {dimension}
              </th>
              <th scope="col" className="hidden pb-2 text-right font-normal sm:table-cell">
                Prior
              </th>
              <th scope="col" className="pb-2 text-right font-normal">
                Selected
              </th>
              <th scope="col" className="pb-2 text-center font-normal">
                Change
              </th>
              <th scope="col" className="pb-2 text-right font-normal">
                Effect
              </th>
              {showShareOfChange ? (
                <th scope="col" className="pb-2 text-right font-normal">
                  Share
                </th>
              ) : null}
              <th scope="col" className="pb-2 text-right font-normal">
                <span className="sr-only">Filter</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const direction = directionOf(row);
              const isFiltered = filtered.has(row.value);
              return (
                <tr key={row.value} className="border-chart-grid border-b last:border-b-0">
                  <th
                    scope="row"
                    className="max-w-40 truncate py-2.5 text-left font-mono font-normal text-xs"
                  >
                    {row.value}
                  </th>
                  <td className="hidden py-2.5 text-right text-muted-foreground tabular-nums sm:table-cell">
                    {formatMetricAmount(row.prior, valueFormat)}
                  </td>
                  <td className="py-2.5 text-right font-semibold tabular-nums">
                    {formatMetricAmount(row.current, valueFormat)}
                  </td>
                  <td className="px-3 py-2.5">
                    <ChangeBar
                      change={row.change}
                      direction={direction}
                      widest={widest}
                      label={changeLabelOf(row, valueFormat)}
                    />
                  </td>
                  <td
                    className="py-2.5 text-right font-medium tabular-nums"
                    style={{ color: CHANGE_DIRECTION_FILL[direction] }}
                  >
                    {formatAbsoluteChange(row.change, valueFormat)}
                  </td>
                  {showShareOfChange ? (
                    <td className="py-2.5 text-right tabular-nums">
                      {formatShare(row.shareOfChange)}
                    </td>
                  ) : null}
                  <td className="py-2.5 pl-2 text-right">
                    <button
                      type="button"
                      disabled={isFiltered || dimension === null}
                      onClick={() =>
                        dimension ? onFilterTo({ name: dimension, value: row.value }) : undefined
                      }
                      aria-label={`Filter to ${dimension} ${row.value}`}
                      title={
                        isFiltered ? 'Already filtered to this value' : `Filter to ${row.value}`
                      }
                      className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground outline-none ring-ring transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 disabled:opacity-30 disabled:hover:bg-transparent"
                    >
                      <Filter className="size-3.5" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      <p className="max-w-[70ch] text-muted-foreground text-xs">
        {showShareOfChange
          ? "Share is each value's part of the total change over the selected window."
          : "Rows are ranked by how much each one moved. Share of the window's total change isn't available for this breakdown."}
      </p>
    </div>
  );
}
