import type { MetricEvent, MetricSummary, PartialRow, RawBreakdownRow } from '@metricyak/storage';
import { TOTAL_SENTINEL } from '@metricyak/storage';
import { fieldPath } from '@/modules/aggregates/engine/ingest.js';
import { aggregateScalar, windowValues } from '@/modules/aggregates/engine/materialize.js';

export type Window = { from: Date; to: Date };

export type ValueResult = {
  value: number | null;
  breakdown?: { dimValue: string; value: number | null }[];
};

export type Mover = {
  dimValue: string;
  current: number | null;
  previous: number | null;
  delta: number;
  contribution: number | null;
};

export type BreakdownResult =
  | { kind: 'movers'; movers: Mover[] }
  | { kind: 'unsupported-dimension' };

export type ReadsAggregates = {
  windowPartials(params: {
    metric: MetricSummary;
    projectId: string;
    window: Window;
  }): Promise<PartialRow[]>;
  rawBreakdown(params: {
    projectId: string;
    eventNames: readonly string[];
    dimField: string;
    valuePath: readonly string[] | null;
    from: Date;
    to: Date;
  }): Promise<RawBreakdownRow[]>;
};

export type MetricReads = {
  value(
    metric: MetricSummary,
    projectId: string,
    window: Window,
    splitBy?: string,
  ): Promise<ValueResult>;
  breakdown(
    metric: MetricSummary,
    projectId: string,
    windows: { current: Window; compare: Window },
    dimension: string,
    limit: number,
  ): Promise<BreakdownResult>;
};

export function createMetricReads(deps: { aggregates: ReadsAggregates }): MetricReads {
  const { aggregates } = deps;

  async function windowByDimension(
    metric: MetricSummary,
    projectId: string,
    window: Window,
    dimension: string,
  ): Promise<Map<string, number | null>> {
    const partials = await aggregates.windowPartials({ metric, projectId, window });
    const byValue = new Map<string, number | null>();
    for (const value of windowValues(metric.definition, partials)) {
      if (value.dimName === dimension) byValue.set(value.dimValue, value.value);
    }
    return byValue;
  }

  async function rawByDimension(
    projectId: string,
    event: MetricEvent,
    eventNames: readonly string[],
    dimension: string,
    window: Window,
  ): Promise<Map<string, number | null>> {
    const rows = await aggregates.rawBreakdown({
      projectId,
      eventNames,
      dimField: dimension,
      valuePath: event.field ? fieldPath(event.field) : null,
      from: window.from,
      to: window.to,
    });
    const byValue = new Map<string, number | null>();
    for (const row of rows) byValue.set(row.dimValue, aggregateScalar(event.aggregation, row));
    return byValue;
  }

  async function value(
    metric: MetricSummary,
    projectId: string,
    window: Window,
    splitBy?: string,
  ): Promise<ValueResult> {
    const partials = await aggregates.windowPartials({ metric, projectId, window });
    const values = windowValues(metric.definition, partials);
    const total = values.find((v) => v.dimName === TOTAL_SENTINEL)?.value ?? null;
    const breakdown = splitBy
      ? values.filter((v) => v.dimName === splitBy).map((v) => ({ dimValue: v.dimValue, value: v.value }))
      : undefined;
    return { value: total, breakdown };
  }

  async function breakdown(
    metric: MetricSummary,
    projectId: string,
    windows: { current: Window; compare: Window },
    dimension: string,
    limit: number,
  ): Promise<BreakdownResult> {
    const declared = metric.definition.dimensions?.includes(dimension) ?? false;

    let current: Map<string, number | null>;
    let previous: Map<string, number | null>;

    if (declared) {
      current = await windowByDimension(metric, projectId, windows.current, dimension);
      previous = await windowByDimension(metric, projectId, windows.compare, dimension);
    } else {
      const [event, ...rest] = metric.definition.events;
      if (!event || rest.length > 0) return { kind: 'unsupported-dimension' };
      const eventNames = metric.definition.events.map((e) => e.type);
      current = await rawByDimension(projectId, event, eventNames, dimension, windows.current);
      previous = await rawByDimension(projectId, event, eventNames, dimension, windows.compare);
    }

    return { kind: 'movers', movers: rankMovers(current, previous, limit) };
  }

  return { value, breakdown };
}

function rankMovers(
  current: Map<string, number | null>,
  previous: Map<string, number | null>,
  limit: number,
): Mover[] {
  const dimValues = new Set([...current.keys(), ...previous.keys()]);
  const rows = [...dimValues].map((dimValue) => {
    const cur = current.get(dimValue) ?? null;
    const prev = previous.get(dimValue) ?? null;
    return { dimValue, current: cur, previous: prev, delta: (cur ?? 0) - (prev ?? 0) };
  });

  const totalDelta = rows.reduce((sum, row) => sum + row.delta, 0);

  return rows
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
    .slice(0, limit)
    .map((row) => ({
      ...row,
      contribution: totalDelta === 0 ? null : row.delta / totalDelta,
    }));
}
