import { describe, expect, it } from 'vitest';
import type { Metric } from '@/api/metrics';
import {
  availableOperatorOptions,
  isFractionalMetric,
  monitorFormSchema,
  toCreateMonitorInput,
} from '@/components/monitors/create/schema';

function metric(overrides: Partial<Metric> = {}): Metric {
  return {
    id: 'm1',
    name: 'Signups',
    description: null,
    definition: { events: [{ key: 's', source: 'web', type: 'signup', aggregation: 'count' }] },
    createdAt: '2026-07-23T00:00:00.000Z',
    updatedAt: '2026-07-23T00:00:00.000Z',
    ...overrides,
  };
}

describe('isFractionalMetric', () => {
  it('is false for a plain count metric', () => {
    expect(isFractionalMetric(metric().definition)).toBe(false);
  });
  it('is true when an event uses a non-count aggregation', () => {
    expect(
      isFractionalMetric({
        events: [
          { key: 'r', source: 'web', type: 'purchase', aggregation: 'sum', field: 'amount' },
        ],
      }),
    ).toBe(true);
  });
  it('is true when the value expression divides', () => {
    expect(
      isFractionalMetric({
        events: [{ key: 'a', source: 'web', type: 'a', aggregation: 'count' }],
        value: 'a / 2',
      }),
    ).toBe(true);
  });
});

describe('availableOperatorOptions', () => {
  it('hides eq/neq for fractional metrics', () => {
    const values = availableOperatorOptions(
      metric({
        definition: {
          events: [{ key: 'r', source: 'web', type: 'p', aggregation: 'sum', field: 'x' }],
        },
      }),
    ).map((o) => o.value);
    expect(values).not.toContain('eq');
    expect(values).not.toContain('neq');
  });
  it('keeps all operators for count metrics', () => {
    expect(availableOperatorOptions(metric()).map((o) => o.value)).toContain('eq');
  });
});

describe('monitorFormSchema', () => {
  it('requires a metric and a threshold value', () => {
    const result = monitorFormSchema.safeParse({
      metricId: '',
      operator: 'lt',
      window: '1d',
      holdFor: '0m',
      missingData: 'skip',
      name: '',
      description: '',
    });
    expect(result.success).toBe(false);
  });
});

describe('toCreateMonitorInput', () => {
  it('builds the API payload and falls back to a generated name', () => {
    const input = toCreateMonitorInput(
      {
        metricId: 'm1',
        operator: 'lt',
        value: 5000,
        window: '1d',
        holdFor: '0m',
        missingData: 'skip',
        name: '',
        description: '',
      },
      metric(),
    );
    expect(input).toEqual({
      name: 'Signups below 5,000',
      description: undefined,
      metricId: 'm1',
      condition: { operator: 'lt', value: 5000 },
      window: '1d',
      holdFor: '0m',
      enabled: true,
      missingData: 'skip',
    });
  });
});
