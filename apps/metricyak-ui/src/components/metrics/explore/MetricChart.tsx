import { type KeyboardEvent, type PointerEvent, useId, useMemo, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import {
  bucketIndexAt,
  isWithin,
  selectedIndexRange,
  selectionFromIndices,
} from './bucket-selection';
import { commitAnnouncement, cursorAnnouncement } from './chart-announcement';
import { type BucketCursor, cursorBounds, nextBucketCursor } from './chart-keyboard-selection';
import { axisTicks, axisTop, bucketCenterPercent, valueHeightPercent } from './chart-scale';
import type { SeriesCoverage } from './coverage';
import type { MetricPoint, ValueFormat } from './explore-model';
import type { ExploreSelection } from './explore-url';
import {
  formatBucketMoment,
  formatTick,
  GRANULARITY_NOUN,
  type Granularity,
  tickWidthPx,
} from './granularity';
import { areaPath, linePath, recordedSegments } from './series-path';
import { formatMetricAmount } from './value-format';

const AXIS_DIVISIONS = 4;
const AXIS_GUTTER_PX = 72;
const MARKER_SLOT_WIDTH_PX = 26;
const MIN_DRAG_PX = 8;
const TICK_LABEL_HALF_PX = 36;
const AREA_GRADIENT_ID = 'metric-series-area';
const IDLE_HATCH = `repeating-linear-gradient(45deg, color-mix(in oklab, var(--chart-grid) 45%, transparent) 0 1px, transparent 1px 13px)`;

interface MetricChartProps {
  metricName: string;
  valueFormat: ValueFormat;
  granularity: Granularity;
  points: readonly MetricPoint[];
  bucketMs: number;
  plotWidthPx: number;
  baseline: number | null;
  coverage: SeriesCoverage | null;
  selection: ExploreSelection | null;
  onSelect: (selection: ExploreSelection | null) => void;
}

const KEY_HINT =
  'Arrow keys move · Shift extends · Page and Home/End jump · Enter selects · Esc clears';

export function MetricChart({
  metricName,
  valueFormat,
  granularity,
  points,
  bucketMs,
  plotWidthPx,
  baseline,
  coverage,
  selection,
  onSelect,
}: MetricChartProps): React.JSX.Element {
  const keyHintId = useId();
  const plotRef = useRef<HTMLDivElement>(null);
  const dragAnchor = useRef<number | null>(null);
  const dragAnchorClientX = useRef(0);
  const [dragRange, setDragRange] = useState<{ from: number; to: number } | null>(null);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [keyboardCursor, setKeyboardCursor] = useState<BucketCursor | null>(null);
  const [announcement, setAnnouncement] = useState('');

  const bucketStarts = useMemo(() => points.map((point) => point.startMs), [points]);
  const lastIndex = points.length - 1;
  const rangeFromMs = bucketStarts[0] ?? 0;
  const rangeToMs = (bucketStarts[lastIndex] ?? 0) + bucketMs;
  const spanMs = rangeToMs - rangeFromMs;

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
    dragAnchorClientX.current = event.clientX;
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
    if (Math.abs(event.clientX - dragAnchorClientX.current) < MIN_DRAG_PX) return;
    commit(anchor, indexFromPointer(event));
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (lastIndex < 0) return;

    if (event.key === 'Escape') {
      setKeyboardCursor(null);
      setAnnouncement(selection === null ? 'Cursor cleared' : 'Selection cleared');
      onSelect(null);
      return;
    }
    if (event.key === 'Enter' || event.key === ' ') {
      if (!cursorRange) return;
      event.preventDefault();
      commit(cursorRange.start, cursorRange.end);
      setAnnouncement(commitAnnouncement(points, cursorRange, granularity));
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

  const segments = useMemo(() => recordedSegments(points, top), [points, top]);

  const drawnSegments = useMemo(
    () =>
      segments.flatMap((segment) => {
        const first = segment[0];
        if (first === undefined || segment.length < 2) return [];
        return [{ startIndex: first.index, line: linePath(segment), area: areaPath(segment) }];
      }),
    [segments],
  );

  const idleSpans = useMemo(() => {
    if (coverage === null || points.length === 0) return [];
    const slotPercent = 100 / points.length;
    const trailingCount = points.length - 1 - coverage.lastRecordedIndex;
    return [
      { key: 'before', startIndex: 0, bucketCount: coverage.firstRecordedIndex },
      { key: 'after', startIndex: coverage.lastRecordedIndex + 1, bucketCount: trailingCount },
    ]
      .filter((span) => span.bucketCount > 0)
      .map((span) => ({
        key: span.key,
        leftPercent: span.startIndex * slotPercent,
        widthPercent: span.bucketCount * slotPercent,
      }));
  }, [coverage, points.length]);

  const markers = useMemo(() => {
    const slotWidthPx = plotWidthPx / Math.max(1, points.length);
    return segments.flatMap((segment) =>
      slotWidthPx >= MARKER_SLOT_WIDTH_PX || segment.length === 1 ? segment : [],
    );
  }, [segments, plotWidthPx, points.length]);

  const tickAreaPx = Math.max(1, plotWidthPx - AXIS_GUTTER_PX);
  const tickSlots = Math.max(1, Math.floor(tickAreaPx / tickWidthPx(granularity, spanMs)));
  const tickEvery = Math.max(1, Math.ceil(points.length / tickSlots));
  const tickEdgePercent = 100 - (TICK_LABEL_HALF_PX / tickAreaPx) * 100;
  const readoutIndex = hoverIndex ?? keyboardCursor?.cursor ?? null;
  const readout = readoutIndex === null ? undefined : points[readoutIndex];
  const readoutHeightPercent =
    readout === undefined || readout.value === null ? null : valueHeightPercent(readout.value, top);

  const cursorIndex = keyboardCursor?.cursor ?? Math.max(0, lastIndex);
  const cursorReadout = cursorAnnouncement(
    points,
    keyboardCursor ?? { anchor: cursorIndex, cursor: cursorIndex },
    granularity,
    valueFormat,
  );

  return (
    <div className="group grid grid-cols-[3.5rem_minmax(0,1fr)] gap-0 sm:grid-cols-[4.5rem_minmax(0,1fr)]">
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
        role="slider"
        tabIndex={0}
        aria-label={`${metricName} by ${GRANULARITY_NOUN[granularity]}`}
        aria-describedby={keyHintId}
        aria-orientation="horizontal"
        aria-valuemin={0}
        aria-valuemax={Math.max(0, lastIndex)}
        aria-valuenow={cursorIndex}
        aria-valuetext={cursorReadout}
        onKeyDown={handleKeyDown}
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

          {idleSpans.map((span) => (
            <div
              key={span.key}
              aria-hidden="true"
              className="absolute inset-y-0"
              style={{
                left: `${span.leftPercent}%`,
                width: `${span.widthPercent}%`,
                background: IDLE_HATCH,
              }}
            />
          ))}

          <div role="presentation" className="absolute inset-0 flex">
            {points.map((point, index) => (
              <div
                key={point.startMs}
                aria-hidden="true"
                className={cn(
                  'h-full flex-1',
                  isWithin(activeRange, index) && 'bg-primary/10',
                  isWithin(cursorRange, index) && 'bg-primary/16',
                )}
              />
            ))}
          </div>

          {baseline !== null ? (
            <div
              aria-hidden="true"
              className="absolute inset-x-0 border-metricyak-500 border-t border-dashed"
              style={{ bottom: `${valueHeightPercent(baseline, top)}%` }}
            />
          ) : null}

          {readoutIndex === null ? null : (
            <div
              aria-hidden="true"
              className="absolute inset-y-0 w-px bg-metricyak-400"
              style={{ left: `${bucketCenterPercent(readoutIndex, points.length)}%` }}
            />
          )}

          <svg
            aria-hidden="true"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
          >
            <defs>
              <linearGradient id={AREA_GRADIENT_ID} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--chart-1)" stopOpacity="0.18" />
                <stop offset="100%" stopColor="var(--chart-1)" stopOpacity="0" />
              </linearGradient>
            </defs>
            {drawnSegments.map((segment) => (
              <path key={segment.startIndex} d={segment.area} fill={`url(#${AREA_GRADIENT_ID})`} />
            ))}
            {drawnSegments.map((segment) => (
              <path
                key={segment.startIndex}
                d={segment.line}
                fill="none"
                stroke="var(--chart-1)"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
              />
            ))}
          </svg>

          {markers.map((plotted) => (
            <span
              key={plotted.index}
              aria-hidden="true"
              className="pointer-events-none absolute size-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-chart-1 ring-2 ring-card"
              style={{ left: `${plotted.xPercent}%`, top: `${plotted.yPercent}%` }}
            />
          ))}

          {readoutHeightPercent === null || readoutIndex === null ? null : (
            <span
              aria-hidden="true"
              className="pointer-events-none absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-chart-1 ring-2 ring-card"
              style={{
                left: `${bucketCenterPercent(readoutIndex, points.length)}%`,
                top: `${100 - readoutHeightPercent}%`,
              }}
            />
          )}
        </div>

        {readout && readoutIndex !== null ? (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute top-2 z-10 min-w-40 -translate-x-1/2 rounded-md border border-border bg-popover px-2.5 py-2 text-popover-foreground shadow-xl"
            style={{
              left: `clamp(5.5rem, ${bucketCenterPercent(readoutIndex, points.length)}%, calc(100% - 5.5rem))`,
            }}
          >
            <p className="text-[11px] text-muted-foreground">
              {formatBucketMoment(readout.startMs)}
            </p>
            <p className="font-semibold text-base tabular-nums">
              {formatMetricAmount(readout.value, valueFormat)}
            </p>
          </div>
        ) : null}
      </div>

      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>

      <div className="sr-only">
        <table>
          <caption>
            {metricName} by {GRANULARITY_NOUN[granularity]}
          </caption>
          <thead>
            <tr>
              <th scope="col">Time</th>
              <th scope="col">Value</th>
            </tr>
          </thead>
          <tbody>
            {points.map((point) => (
              <tr key={point.startMs}>
                <th scope="row">{formatBucketMoment(point.startMs)}</th>
                <td>{formatMetricAmount(point.value, valueFormat)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p
        id={keyHintId}
        className="sr-only col-start-2 text-[11px] text-muted-foreground group-focus-within:not-sr-only group-focus-within:mt-1.5"
      >
        {KEY_HINT}
      </p>

      <div className="relative col-start-2 mt-1.5 h-3.5 text-[10px] text-muted-foreground tabular-nums">
        {points.map((point, index) => {
          if (index % tickEvery !== 0) return null;
          const centerPercent = bucketCenterPercent(index, points.length);
          return (
            <span
              key={point.startMs}
              className={cn(
                'absolute top-0 whitespace-nowrap',
                index > 0 && centerPercent < tickEdgePercent && '-translate-x-1/2',
                centerPercent >= tickEdgePercent && '-translate-x-full',
              )}
              style={{ left: `${centerPercent}%` }}
            >
              {formatTick(point.startMs, granularity, spanMs)}
            </span>
          );
        })}
      </div>
    </div>
  );
}
