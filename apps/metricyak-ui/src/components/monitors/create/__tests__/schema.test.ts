import { describe, expect, it } from 'vitest';
import type { Metric } from '@/api/metrics';
import {
  advancedSummary,
  availableOperatorOptions,
  isFractionalMetric,
  isPercentageMetric,
  monitorFormSchema,
  thresholdPlaceholder,
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

const CONVERSION_DEFINITION = {
  events: [
    { key: 'completed', source: 'web', type: 'checkout_completed', aggregation: 'count' as const },
    { key: 'started', source: 'web', type: 'checkout_started', aggregation: 'count' as const },
  ],
  value: 'completed / started * 100',
};

describe('isPercentageMetric', () => {
  it('is true for a ratio scaled to 100', () => {
    expect(isPercentageMetric(CONVERSION_DEFINITION)).toBe(true);
  });
  it('is false for a bare ratio', () => {
    expect(isPercentageMetric({ ...CONVERSION_DEFINITION, value: 'completed / started' })).toBe(
      false,
    );
  });
  it('is false without a division', () => {
    expect(isPercentageMetric(metric().definition)).toBe(false);
  });
});

describe('thresholdPlaceholder', () => {
  it('suggests a percentage for a rate metric', () => {
    expect(thresholdPlaceholder(metric({ definition: CONVERSION_DEFINITION }))).toBe('70');
  });
  it('suggests a fraction for a non-percentage ratio', () => {
    expect(
      thresholdPlaceholder(
        metric({ definition: { ...CONVERSION_DEFINITION, value: 'completed / started' } }),
      ),
    ).toBe('0.5');
  });
  it('suggests a count for a plain count metric', () => {
    expect(thresholdPlaceholder(metric())).toBe('5000');
  });
});

describe('advancedSummary', () => {
  it('summarises the collapsed advanced settings', () => {
    expect(advancedSummary('0m', 'skip')).toBe('Fires immediately · Ignores missing data');
    expect(advancedSummary('15m', 'fire')).toBe('Fires after 15 minutes · Alerts on missing data');
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
      enabled: true,
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
        enabled: true,
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

  it('carries a paused monitor through as enabled false', () => {
    const input = toCreateMonitorInput(
      {
        metricId: 'm1',
        operator: 'lt',
        value: 70,
        window: '1h',
        holdFor: '0m',
        missingData: 'skip',
        enabled: false,
        name: '',
        description: '',
      },
      metric(),
    );
    expect(input.enabled).toBe(false);
  });
});
