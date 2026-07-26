import { useReducedMotion } from 'motion/react';
import { type MouseEvent, useMemo, useRef } from 'react';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceArea,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { CategoricalChartFunc } from 'recharts/types/chart/types';
import type { MouseHandlerDataParam } from 'recharts/types/synchronisation/types';
import { type MetricSeries, OTHER_DIM_VALUE } from '@/api/metric-series';
import type { MetricDefinition } from '@/api/metrics';
import { ChartContainer, ChartTooltipCard, chartStrokeFor } from '@/components/ui/chart';
import type { ExploreSelection } from './explore-url';
import { formatDelta, formatMetricValue, formatSpan } from './format';
import { formatTick, GRANULARITY_MS, type Granularity } from './granularity';
import { yDomainFor } from './y-domain';

const DRAG_THRESHOLD_PX = 4;
const COMPARE_KEY = 'compare';

function activeLabelOf(state: MouseHandlerDataParam): string | null {
  return typeof state.activeLabel === 'string' ? state.activeLabel : null;
}

export type ChartRow = { start: string } & Record<string, number | null | string>;

export function seriesLabel(series: MetricSeries, metricName: string): string {
  if (series.dimValue === null) return metricName;
  return series.dimValue === OTHER_DIM_VALUE ? 'Other' : series.dimValue;
}

export function seriesStroke(series: MetricSeries, index: number): string {
  return series.dimValue === OTHER_DIM_VALUE ? 'var(--chart-other)' : chartStrokeFor(index);
}

export function toChartRows(
  series: readonly MetricSeries[],
  compareSeries: readonly MetricSeries[] | null,
): ChartRow[] {
  const first = series[0];
  if (!first) return [];
  const comparePoints = compareSeries?.[0]?.points ?? null;

  return first.points.map((point, index) => {
    const row: ChartRow = { start: point.start };
    series.forEach((entry, seriesIndex) => {
      row[`s${seriesIndex}`] = entry.points[index]?.value ?? null;
    });
    if (comparePoints) row[COMPARE_KEY] = comparePoints[index]?.value ?? null;
    return row;
  });
}

interface TooltipEntry {
  dataKey?: string | number;
  name?: string | number;
  value?: number | null;
  color?: string;
}

function MetricChartTooltip({
  active,
  label,
  payload,
  granularity,
}: {
  active?: boolean;
  label?: string;
  payload?: readonly TooltipEntry[];
  granularity: Granularity;
}): React.JSX.Element | null {
  if (!active || !payload || payload.length === 0 || typeof label !== 'string') return null;

  const bucketEnd = new Date(new Date(label).getTime() + GRANULARITY_MS[granularity]).toISOString();
  const primary = payload.find((entry) => entry.dataKey === 's0');
  const compare = payload.find((entry) => entry.dataKey === COMPARE_KEY);
  const delta = compare ? formatDelta(primary?.value ?? null, compare.value ?? null) : null;

  return (
    <ChartTooltipCard title={formatSpan(label, bucketEnd)}>
      {payload.map((entry) => (
        <div key={String(entry.dataKey)} className="flex items-center gap-2 text-xs">
          <span
            aria-hidden="true"
            className="size-2 shrink-0 rounded-full"
            style={{ backgroundColor: entry.color }}
          />
          <span className="flex-1 truncate text-muted-foreground">{entry.name}</span>
          <span className="font-medium text-foreground tabular-nums">
            {formatMetricValue(entry.value ?? null)}
          </span>
        </div>
      ))}
      {delta ? (
        <p className="pt-0.5 text-muted-foreground text-xs">{delta} vs previous period</p>
      ) : null}
    </ChartTooltipCard>
  );
}

interface MetricChartProps {
  series: readonly MetricSeries[];
  compareSeries: readonly MetricSeries[] | null;
  definition: MetricDefinition;
  metricName: string;
  granularity: Granularity;
  selection: ExploreSelection | null;
  onSelect: (selection: ExploreSelection) => void;
}

export function MetricChart({
  series,
  compareSeries,
  definition,
  metricName,
  granularity,
  selection,
  onSelect,
}: MetricChartProps): React.JSX.Element {
  const reduceMotion = useReducedMotion();
  const rows = useMemo(() => toChartRows(series, compareSeries), [series, compareSeries]);
  const dragStart = useRef<{ label: string; x: number } | null>(null);
  const dragEnd = useRef<string | null>(null);

  const finePointer = typeof window !== 'undefined' && window.matchMedia('(pointer: fine)').matches;
  const step = GRANULARITY_MS[granularity];

  const emitSelection = (fromLabel: string, toLabel: string): void => {
    const fromMs = new Date(fromLabel).getTime();
    const toMs = new Date(toLabel).getTime();
    if (Number.isNaN(fromMs) || Number.isNaN(toMs)) return;
    const [start, end] = fromMs <= toMs ? [fromMs, toMs] : [toMs, fromMs];
    onSelect({
      from: new Date(start).toISOString(),
      to: new Date(end + step).toISOString(),
    });
  };

  const handleMouseDown: CategoricalChartFunc<MouseEvent<SVGGraphicsElement>> = (state) => {
    const label = activeLabelOf(state);
    if (!finePointer || label === null) return;
    dragStart.current = { label, x: state.activeCoordinate?.x ?? 0 };
    dragEnd.current = label;
  };

  const handleMouseMove: CategoricalChartFunc<MouseEvent<SVGGraphicsElement>> = (state) => {
    const label = activeLabelOf(state);
    if (dragStart.current && label !== null) dragEnd.current = label;
  };

  const handleMouseUp: CategoricalChartFunc<MouseEvent<SVGGraphicsElement>> = (state) => {
    const start = dragStart.current;
    dragStart.current = null;
    if (!start) return;
    const moved = Math.abs((state.activeCoordinate?.x ?? start.x) - start.x);
    const end = moved < DRAG_THRESHOLD_PX ? start.label : (dragEnd.current ?? start.label);
    emitSelection(start.label, end);
  };

  const handleClick: CategoricalChartFunc<MouseEvent<SVGGraphicsElement>> = (state) => {
    const label = activeLabelOf(state);
    if (finePointer || label === null) return;
    emitSelection(label, label);
  };

  return (
    <ChartContainer height="100%">
      <LineChart
        accessibilityLayer
        data={rows}
        margin={{ top: 8, right: 12, bottom: 0, left: 0 }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onClick={handleClick}
      >
        <CartesianGrid vertical={false} stroke="var(--border)" />
        <XAxis
          dataKey="start"
          tickFormatter={(value: string) => formatTick(value, granularity)}
          tickLine={false}
          axisLine={false}
          minTickGap={48}
          tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }}
        />
        <YAxis
          domain={yDomainFor(definition)}
          tickFormatter={(value: number) => formatMetricValue(value)}
          tickLine={false}
          axisLine={false}
          width={52}
          tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }}
        />
        <Tooltip
          cursor={{ stroke: 'var(--muted-foreground)', strokeWidth: 1 }}
          content={<MetricChartTooltip granularity={granularity} />}
        />
        {series.length >= 2 || compareSeries ? (
          <Legend
            verticalAlign="bottom"
            height={28}
            iconType="plainline"
            wrapperStyle={{ fontSize: 12, color: 'var(--muted-foreground)' }}
          />
        ) : null}
        {selection ? (
          <ReferenceArea
            x1={selection.from}
            x2={selection.to}
            fill="var(--chart-1)"
            fillOpacity={0.12}
            stroke="var(--chart-1)"
            strokeOpacity={0.4}
          />
        ) : null}
        {series.map((entry, index) => (
          <Line
            key={seriesLabel(entry, metricName)}
            type="monotone"
            dataKey={`s${index}`}
            name={seriesLabel(entry, metricName)}
            stroke={seriesStroke(entry, index)}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
            isAnimationActive={!reduceMotion}
            animationDuration={200}
          />
        ))}
        {compareSeries ? (
          <Line
            dataKey={COMPARE_KEY}
            type="monotone"
            name="Previous period"
            stroke="var(--chart-compare)"
            strokeWidth={1.5}
            strokeDasharray="4 4"
            dot={false}
            activeDot={{ r: 3 }}
            isAnimationActive={!reduceMotion}
            animationDuration={200}
          />
        ) : null}
      </LineChart>
    </ChartContainer>
  );
}
