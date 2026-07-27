import { describe, expect, it } from 'vitest';
import type { Metric } from '@/api/metrics';
import { isAdditive, toExploreMetric } from '../metric-shape';

function metricWith(definition: Metric['definition']): Metric {
  return {
    id: 'metric-1',
    name: 'Checkout conversion rate',
    description: null,
    definition,
    createdAt: '2026-07-01T00:00:00.000Z',
    updatedAt: '2026-07-01T00:00:00.000Z',
  };
}

describe('toExploreMetric', () => {
  it('reads a single count metric as an integer count', () => {
    const metric = toExploreMetric(
      metricWith({
        events: [{ key: 'a', source: 's', type: 'checkout_failed', aggregation: 'count' }],
      }),
    );
    expect(metric.kind).toBe('count');
    expect(metric.valueFormat).toBe('integer');
    expect(metric.expression).toBe('count(checkout_failed)');
  });

  it('reads a count over a count as a percentage ratio', () => {
    const metric = toExploreMetric(
      metricWith({
        events: [
          { key: 'a', source: 's', type: 'checkout_completed', aggregation: 'count' },
          { key: 'b', source: 's', type: 'session_start', aggregation: 'count' },
        ],
        value: 'a / b',
      }),
    );
    expect(metric.kind).toBe('ratio');
    expect(metric.valueFormat).toBe('percent');
  });

  it('reads a sum over a count as a decimal ratio, not a percentage', () => {
    const metric = toExploreMetric(
      metricWith({
        events: [
          { key: 'a', source: 's', type: 'order', aggregation: 'sum', field: 'amount_usd' },
          { key: 'b', source: 's', type: 'order', aggregation: 'count' },
        ],
        value: 'a / b',
      }),
    );
    expect(metric.kind).toBe('ratio');
    expect(metric.valueFormat).toBe('decimal');
  });

  it('reads an average metric as a decimal and names its field', () => {
    const metric = toExploreMetric(
      metricWith({
        events: [
          {
            key: 'a',
            source: 's',
            type: 'refund_issued',
            aggregation: 'average',
            field: 'amount_usd',
          },
        ],
      }),
    );
    expect(metric.kind).toBe('average');
    expect(metric.valueFormat).toBe('decimal');
    expect(metric.expression).toBe('average(refund_issued.amount_usd)');
  });

  it('does not let one key match inside another event field name', () => {
    const metric = toExploreMetric(
      metricWith({
        events: [
          { key: 'a', source: 's', type: 'order', aggregation: 'average', field: 'amount_usd' },
          { key: 's', source: 's', type: 'session_start', aggregation: 'count' },
        ],
        value: 'a / s',
      }),
    );
    expect(metric.expression).toBe('average(order.amount_usd) / count(session_start)');
  });

  it('exposes declared dimensions and defaults them to empty', () => {
    const withDims = toExploreMetric(
      metricWith({
        events: [{ key: 'a', source: 's', type: 'x', aggregation: 'count' }],
        dimensions: ['country', 'platform'],
      }),
    );
    const withoutDims = toExploreMetric(
      metricWith({ events: [{ key: 'a', source: 's', type: 'x', aggregation: 'count' }] }),
    );
    expect(withDims.dimensions).toEqual(['country', 'platform']);
    expect(withoutDims.dimensions).toEqual([]);
  });
});

describe('isAdditive', () => {
  it('is true only for count and sum', () => {
    expect(isAdditive('count')).toBe(true);
    expect(isAdditive('sum')).toBe(true);
    expect(isAdditive('average')).toBe(false);
    expect(isAdditive('ratio')).toBe(false);
    expect(isAdditive('min')).toBe(false);
    expect(isAdditive('max')).toBe(false);
  });
});
