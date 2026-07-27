export type MetricKind = 'count' | 'sum' | 'average' | 'min' | 'max' | 'ratio';

export type ValueFormat = 'integer' | 'decimal' | 'percent';

export interface ExploreMetric {
  readonly id: string;
  readonly name: string;
  readonly description: string | null;
  readonly expression: string;
  readonly kind: MetricKind;
  readonly valueFormat: ValueFormat;
  readonly dimensions: readonly string[];
}

export interface MetricPoint {
  readonly startMs: number;
  readonly value: number | null;
}

export interface DimensionValue {
  readonly dimValue: string;
  readonly value: number | null;
}

export interface WindowValues {
  readonly value: number | null;
  readonly breakdown: readonly DimensionValue[];
}

export interface WindowStats {
  readonly fromMs: number;
  readonly toMs: number;
  readonly value: number | null;
  readonly baseline: number | null;
  readonly changeRatio: number | null;
  readonly peak: number | null;
  readonly pointCount: number;
}

export interface BreakdownRow {
  readonly value: string;
  readonly current: number | null;
  readonly prior: number | null;
  readonly change: number | null;
  readonly changeRatio: number | null;
  readonly shareOfChange: number | null;
}

export interface SummaryTile {
  readonly label: string;
  readonly value: string;
  readonly footnote: string;
}
