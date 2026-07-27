import { type KeyboardEvent, type PointerEvent, useMemo, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import {
  bucketIndexAt,
  isWithin,
  selectedIndexRange,
  selectionFromIndices,
} from './bucket-selection';
import { type BucketCursor, cursorBounds, nextBucketCursor } from './chart-keyboard-selection';
import { axisTicks, axisTop, barHeightPercent } from './chart-scale';
import type { MetricPoint, ValueFormat } from './explore-model';
import type { ExploreSelection } from './explore-url';
import { formatBucketMoment, formatTick, GRANULARITY_NOUN, type Granularity } from './granularity';
import { isUnusual, type SwingBand } from './unusual-swing';
import { formatMetricAmount } from './value-format';

const AXIS_DIVISIONS = 4;
const TICK_TARGET_PX = 84;

interface MetricChartProps {
  metricName: string;
  valueFormat: ValueFormat;
  granularity: Granularity;
  points: readonly MetricPoint[];
  bucketMs: number;
  plotWidthPx: number;
  baseline: number | null;
  band: SwingBand | null;
  selection: ExploreSelection | null;
  onSelect: (selection: ExploreSelection | null) => void;
}

function bucketOptionId(startMs: number): string {
  return `metric-bucket-${startMs}`;
}

function barFill(inWindow: boolean, unusual: boolean): string {
  if (inWindow) return unusual ? 'var(--chart-unusual)' : 'var(--chart-1)';
  return unusual
    ? 'color-mix(in oklab, var(--chart-unusual) 42%, var(--chart-bar-idle))'
    : 'var(--chart-bar-idle)';
}

function barRing(inWindow: boolean, unusual: boolean): string | undefined {
  if (!unusual || !inWindow) return undefined;
  return '0 0 0 1px color-mix(in oklab, var(--chart-unusual) 60%, var(--foreground))';
}

export function MetricChart({
  metricName,
  valueFormat,
  granularity,
  points,
  bucketMs,
  plotWidthPx,
  baseline,
  band,
  selection,
  onSelect,
}: MetricChartProps): React.JSX.Element {
  const plotRef = useRef<HTMLDivElement>(null);
  const dragAnchor = useRef<number | null>(null);
  const [dragRange, setDragRange] = useState<{ from: number; to: number } | null>(null);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [keyboardCursor, setKeyboardCursor] = useState<BucketCursor | null>(null);

  const bucketStarts = useMemo(() => points.map((point) => point.startMs), [points]);
  const lastIndex = points.length - 1;
  const rangeFromMs = bucketStarts[0] ?? 0;
  const rangeToMs = (bucketStarts[lastIndex] ?? 0) + bucketMs;

  const top = useMemo(
    () =>
      axisTop(
        points.reduce<number | null>(
          (largest, point) =>
            point.value === null ? largest : Math.max(largest ?? 0, point.value),
          null,
        ),
      ),
    [points],
  );

  const committedRange = selectedIndexRange(bucketStarts, selection);
  const activeRange = dragRange
    ? { start: Math.min(dragRange.from, dragRange.to), end: Math.max(dragRange.from, dragRange.to) }
    : committedRange;

  const cursorRange = keyboardCursor ? cursorBounds(keyboardCursor) : null;

  const commit = (first: number, second: number): void => {
    onSelect(selectionFromIndices(bucketStarts, bucketMs, first, second));
  };

  const indexFromPointer = (event: PointerEvent<HTMLDivElement>): number => {
    const plot = plotRef.current;
    if (!plot) return 0;
    const bounds = plot.getBoundingClientRect();
    return bucketIndexAt(event.clientX - bounds.left, bounds.width, points.length);
  };

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>): void => {
    if (event.button !== 0 || points.length === 0) return;
    const index = indexFromPointer(event);
    dragAnchor.current = index;
    setDragRange({ from: index, to: index });
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>): void => {
    const index = indexFromPointer(event);
    setHoverIndex(index);
    if (dragAnchor.current !== null) setDragRange({ from: dragAnchor.current, to: index });
  };

  const handlePointerUp = (event: PointerEvent<HTMLDivElement>): void => {
    const anchor = dragAnchor.current;
    dragAnchor.current = null;
    setDragRange(null);
    if (anchor === null) return;
    event.currentTarget.releasePointerCapture(event.pointerId);
    commit(anchor, indexFromPointer(event));
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (lastIndex < 0) return;

    if (event.key === 'Escape') {
      setKeyboardCursor(null);
      return;
    }
    if (event.key === 'Enter' || event.key === ' ') {
      if (!cursorRange) return;
      event.preventDefault();
      commit(cursorRange.start, cursorRange.end);
      return;
    }

    const moved = nextBucketCursor(keyboardCursor ?? { anchor: lastIndex, cursor: lastIndex }, {
      key: event.key,
      extend: event.shiftKey,
      lastIndex,
    });
    if (!moved) return;
    event.preventDefault();
    setKeyboardCursor(moved);
  };

  const tickSlots = Math.max(1, Math.floor(plotWidthPx / TICK_TARGET_PX));
  const tickEvery = Math.max(1, Math.ceil(points.length / tickSlots));
  const slotWidthPx = points.length > 0 ? plotWidthPx / points.length : 0;
  const barGapPx = slotWidthPx >= 6 ? 2 : 1;
  const barRadiusPx = Math.min(4, Math.max(1, Math.floor((slotWidthPx - barGapPx) / 2)));
  const hovered = hoverIndex === null ? null : points[hoverIndex];
  const cursorPoint = keyboardCursor ? points[keyboardCursor.cursor] : undefined;

  return (
    <div className="grid grid-cols-[3.5rem_minmax(0,1fr)] gap-0 sm:grid-cols-[4.5rem_minmax(0,1fr)]">
      <div className="relative h-56 pr-2.5 text-[10px] text-muted-foreground tabular-nums sm:h-64 xl:h-72">
        {axisTicks(top, AXIS_DIVISIONS).map((tick, index) => (
          <span
            key={tick}
            className="absolute right-2.5 translate-y-1/2 text-right"
            style={{ bottom: `${(index / AXIS_DIVISIONS) * 100}%` }}
          >
            {formatMetricAmount(tick, valueFormat)}
          </span>
        ))}
      </div>

      <div
        role="listbox"
        tabIndex={0}
        aria-multiselectable="true"
        aria-activedescendant={cursorPoint ? bucketOptionId(cursorPoint.startMs) : undefined}
        aria-label={`${metricName} by ${GRANULARITY_NOUN[granularity]}. Arrow keys move between buckets, Shift with arrows extends the range, Enter selects it.`}
        onKeyDown={handleKeyDown}
        onBlur={() => setKeyboardCursor(null)}
        className="relative h-56 touch-none rounded-sm outline-none ring-ring focus-visible:ring-2 sm:h-64 xl:h-72"
      >
        <div
          ref={plotRef}
          role="presentation"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={() => setHoverIndex(null)}
          className="absolute inset-0 cursor-crosshair select-none"
        >
          {axisTicks(top, AXIS_DIVISIONS).map((tick, index) => (
            <div
              key={tick}
              aria-hidden="true"
              className="absolute inset-x-0 h-px bg-chart-grid"
              style={{ bottom: `${(index / AXIS_DIVISIONS) * 100}%` }}
            />
          ))}

          {baseline !== null ? (
            <div
              aria-hidden="true"
              className="absolute inset-x-0 border-metricyak-500 border-t border-dashed"
              style={{ bottom: `${barHeightPercent(baseline, top)}%` }}
            />
          ) : null}

          <div
            role="presentation"
            className="absolute inset-0 flex items-end"
            style={{ gap: barGapPx }}
          >
            {points.map((point, index) => {
              const inWindow = activeRange === null || isWithin(activeRange, index);
              const unusual = isUnusual(point.value, band);
              return (
                <div
                  key={point.startMs}
                  id={bucketOptionId(point.startMs)}
                  role="option"
                  tabIndex={-1}
                  aria-selected={isWithin(committedRange, index)}
                  aria-label={`${formatBucketMoment(point.startMs)}, ${formatMetricAmount(point.value, valueFormat)}`}
                  className={cn(
                    'flex h-full flex-1 items-end',
                    isWithin(activeRange, index) && 'bg-primary/8',
                    isWithin(cursorRange, index) && 'bg-primary/12',
                  )}
                >
                  <div
                    className="w-full transition-[background-color] duration-150 motion-reduce:transition-none"
                    style={{
                      height: `${barHeightPercent(point.value, top)}%`,
                      borderRadius: `${barRadiusPx}px ${barRadiusPx}px 0 0`,
                      background:
                        hoverIndex === index
                          ? `color-mix(in oklab, ${barFill(inWindow, unusual)} 78%, var(--foreground))`
                          : barFill(inWindow, unusual),
                      boxShadow: barRing(inWindow, unusual),
                    }}
                  />
                </div>
              );
            })}
          </div>
        </div>

        {hovered ? (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute top-2 z-10 min-w-40 -translate-x-1/2 rounded-md border border-border bg-popover px-2.5 py-2 text-popover-foreground shadow-xl"
            style={{
              left: `clamp(5.5rem, ${(((hoverIndex ?? 0) + 0.5) / points.length) * 100}%, calc(100% - 5.5rem))`,
            }}
          >
            <p className="text-[11px] text-muted-foreground">
              {formatBucketMoment(hovered.startMs)}
            </p>
            <p className="font-semibold text-base tabular-nums">
              {formatMetricAmount(hovered.value, valueFormat)}
            </p>
          </div>
        ) : null}
      </div>

      <div className="relative col-start-2 mt-1.5 h-3.5 text-[10px] text-muted-foreground tabular-nums">
        {points.map((point, index) =>
          index % tickEvery === 0 ? (
            <span
              key={point.startMs}
              className={cn('absolute top-0 whitespace-nowrap', index > 0 && '-translate-x-1/2')}
              style={{ left: `${((index + 0.5) / points.length) * 100}%` }}
            >
              {formatTick(point.startMs, granularity, rangeToMs - rangeFromMs)}
            </span>
          ) : null,
        )}
      </div>
    </div>
  );
}
