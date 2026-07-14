import { apiFetch } from '@/lib/api';

export const METRIC_AGGREGATIONS = ['count', 'sum', 'average', 'min', 'max'] as const;

export type MetricAggregation = (typeof METRIC_AGGREGATIONS)[number];

export type MetricEvent = {
  key: string;
  source: string;
  type: string;
  aggregation: MetricAggregation;
  field?: string | null;
};

export type MetricDefinition = {
  events: MetricEvent[];
  value?: string;
  dimensions?: string[];
};

export type Metric = {
  id: string;
  name: string;
  description?: string | null;
  definition: MetricDefinition;
  createdAt: string;
  updatedAt: string;
};

export type CreateMetricInput = {
  name: string;
  description?: string;
  definition: MetricDefinition;
};

export function listMetrics(projectId: string): Promise<Metric[]> {
  return apiFetch<Metric[]>(`/v1/projects/${projectId}/metrics`);
}

export function createMetric(projectId: string, input: CreateMetricInput): Promise<Metric> {
  return apiFetch<Metric>(`/v1/projects/${projectId}/metrics`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}
