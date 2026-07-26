import type { DefaultValues } from 'react-hook-form';
import { z } from 'zod';
import type { Metric, MetricDefinition } from '@/api/metrics';
import {
  type ConditionOperator,
  type CreateMonitorInput,
  MONITOR_MISSING_DATA_STRATEGIES,
  MONITOR_OPERATORS,
} from '@/api/monitors';
import { defaultMonitorName } from '@/components/monitors/condition-sentence';

export const OPERATOR_OPTIONS: readonly { value: ConditionOperator; label: string }[] = [
  { value: 'lt', label: 'is below' },
  { value: 'lte', label: 'is at or below' },
  { value: 'gt', label: 'is above' },
  { value: 'gte', label: 'is at or above' },
  { value: 'eq', label: 'equals' },
  { value: 'neq', label: 'is not' },
];

export const WINDOW_OPTIONS: readonly { value: string; label: string }[] = [
  { value: '5m', label: 'Last 5 minutes' },
  { value: '15m', label: 'Last 15 minutes' },
  { value: '1h', label: 'Last hour' },
  { value: '6h', label: 'Last 6 hours' },
  { value: '1d', label: 'Last day' },
  { value: '7d', label: 'Last 7 days' },
];

export const HOLD_FOR_OPTIONS: readonly { value: string; label: string; summary: string }[] = [
  { value: '0m', label: 'Immediately', summary: 'Fires immediately' },
  { value: '5m', label: 'After 5 minutes', summary: 'Fires after 5 minutes' },
  { value: '15m', label: 'After 15 minutes', summary: 'Fires after 15 minutes' },
  { value: '1h', label: 'After 1 hour', summary: 'Fires after 1 hour' },
];

export const MISSING_DATA_OPTIONS: readonly {
  value: (typeof MONITOR_MISSING_DATA_STRATEGIES)[number];
  label: string;
  summary: string;
}[] = [
  { value: 'skip', label: "Don't alert (safest)", summary: 'Ignores missing data' },
  { value: 'zero', label: 'Treat as zero', summary: 'Treats missing data as zero' },
  { value: 'fire', label: 'Alert on missing data', summary: 'Alerts on missing data' },
];

export function advancedSummary(holdFor: string, missingData: string): string {
  const hold = HOLD_FOR_OPTIONS.find((option) => option.value === holdFor)?.summary;
  const missing = MISSING_DATA_OPTIONS.find((option) => option.value === missingData)?.summary;
  return [hold, missing].filter(Boolean).join(' · ');
}

export function isFractionalMetric(definition: MetricDefinition): boolean {
  const everyCount = definition.events.every((event) => event.aggregation === 'count');
  if (!everyCount) return true;
  return definition.value?.includes('/') ?? false;
}

export function isPercentageMetric(definition: MetricDefinition): boolean {
  const expression = definition.value;
  if (!expression?.includes('/')) return false;
  return /\*\s*100(?!\d)/.test(expression) || /100\s*\*/.test(expression);
}

export function thresholdPlaceholder(metric: Metric | null): string {
  if (!metric) return '5000';
  if (isPercentageMetric(metric.definition)) return '70';
  if (isFractionalMetric(metric.definition)) return '0.5';
  return '5000';
}

export function availableOperatorOptions(
  metric: Metric | null,
): readonly { value: ConditionOperator; label: string }[] {
  if (metric && isFractionalMetric(metric.definition)) {
    return OPERATOR_OPTIONS.filter((option) => option.value !== 'eq' && option.value !== 'neq');
  }
  return OPERATOR_OPTIONS;
}

export const monitorFormSchema = z.object({
  metricId: z.string().min(1, 'Pick a metric to watch.'),
  operator: z.enum(MONITOR_OPERATORS),
  value: z
    .number({ error: 'Enter a threshold value.' })
    .refine((value) => Number.isFinite(value), 'Enter a threshold value.'),
  window: z.enum(['5m', '15m', '1h', '6h', '1d', '7d']),
  holdFor: z.enum(['0m', '5m', '15m', '1h']),
  missingData: z.enum(MONITOR_MISSING_DATA_STRATEGIES),
  enabled: z.boolean(),
  name: z.string().trim().optional(),
  description: z.string().trim().optional(),
});

export type MonitorFormValues = z.infer<typeof monitorFormSchema>;

export const defaultMonitorFormValues: DefaultValues<MonitorFormValues> = {
  metricId: '',
  operator: 'lt',
  window: '1d',
  holdFor: '0m',
  missingData: 'skip',
  enabled: true,
  name: '',
  description: '',
};

export function toCreateMonitorInput(
  values: MonitorFormValues,
  metric: Metric | null,
): CreateMonitorInput {
  const name =
    values.name?.trim() ||
    defaultMonitorName({
      metricName: metric?.name ?? 'Metric',
      operator: values.operator,
      value: values.value,
    });
  return {
    name,
    description: values.description?.trim() || undefined,
    metricId: values.metricId,
    condition: { operator: values.operator, value: values.value },
    window: values.window,
    holdFor: values.holdFor,
    enabled: values.enabled,
    missingData: values.missingData,
  };
}
