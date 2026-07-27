import { describe, expect, it } from 'vitest';
import type { ExploreMetric, WindowStats } from '../explore-model';
import { summaryTilesFor } from '../summary-tiles';

function metricOf(overrides: Partial<ExploreMetric>): ExploreMetric {
  return {
    id: 'm1',
    name: 'Checkout errors',
    description: null,
    expression: 'count(checkout_failed)',
    kind: 'count',
    valueFormat: 'integer',
    dimensions: [],
    ...overrides,
  };
}

const stats: WindowStats = {
  fromMs: 0,
  toMs: 1000,
  value: 240,
  baseline: 300,
  changeRatio: -0.2,
  peak: 42,
  pointCount: 24,
};

describe('summaryTilesFor', () => {
  it('always returns four tiles', () => {
    expect(summaryTilesFor(metricOf({}), stats, '1h')).toHaveLength(4);
  });

  it('leads a count metric with its total and names the highest bucket', () => {
    const tiles = summaryTilesFor(metricOf({}), stats, '1h');
    expect(tiles[0]?.label).toBe('Total over selection');
    expect(tiles[0]?.value).toBe('240');
    expect(tiles[2]?.label).toBe('Highest bucket');
    expect(tiles[2]?.value).toBe('42');
    expect(tiles[2]?.footnote).toBe('highest single hour');
  });

  it('describes the peak bucket by height for kinds where volume would be a lie', () => {
    const tiles = summaryTilesFor(
      metricOf({ kind: 'ratio', valueFormat: 'percent' }),
      { ...stats, peak: 1 },
      '1d',
    );
    expect(tiles[2]?.label).toBe('Highest bucket');
    expect(tiles[2]?.value).toBe('100.00%');
    expect(tiles[2]?.footnote).toBe('highest single day');
  });

  it('shows the change against the prior window', () => {
    const [, change] = summaryTilesFor(metricOf({}), stats, '1h');
    expect(change?.label).toBe('Change vs prior window');
    expect(change?.value).toBe('−20%');
    expect(change?.footnote).toBe('prior 300');
  });

  it('does not claim a missing prior window when the prior window was zero', () => {
    const [, change] = summaryTilesFor(
      metricOf({}),
      { ...stats, baseline: 0, changeRatio: null },
      '1h',
    );
    expect(change?.value).toBe('—');
    expect(change?.footnote).toBe('prior 0');
  });

  it('blames the missing prior value, not a missing prior window', () => {
    const [, change] = summaryTilesFor(
      metricOf({}),
      { ...stats, baseline: null, changeRatio: null },
      '1h',
    );
    expect(change?.value).toBe('—');
    expect(change?.footnote).toBe('no prior value to compare');
  });

  it('reports how many buckets carried a value, not how many the window holds', () => {
    const tiles = summaryTilesFor(metricOf({}), { ...stats, pointCount: 18 }, '5m');
    expect(tiles[3]?.label).toBe('Buckets with data');
    expect(tiles[3]?.value).toBe('18');
    expect(tiles[3]?.footnote).toBe('5-minute buckets with a recorded value');
  });

  it('leads a ratio metric with its rate', () => {
    const tiles = summaryTilesFor(
      metricOf({ kind: 'ratio', valueFormat: 'percent', expression: 'a / b' }),
      { ...stats, value: 0.0315, baseline: 0.04 },
      '1h',
    );
    expect(tiles[0]?.label).toBe('Rate over selection');
    expect(tiles[0]?.value).toBe('3.15%');
  });

  it('names the aggregation for the kinds that report an extreme or a sum', () => {
    expect(summaryTilesFor(metricOf({ kind: 'sum' }), stats, '1h')[0]?.label).toBe(
      'Total over selection',
    );
    expect(summaryTilesFor(metricOf({ kind: 'min' }), stats, '1h')[0]?.label).toBe(
      'Lowest over selection',
    );
    expect(summaryTilesFor(metricOf({ kind: 'max' }), stats, '1h')[0]?.label).toBe(
      'Highest over selection',
    );
  });

  it('formats the prior value as the metric but the bucket count as a count', () => {
    const tiles = summaryTilesFor(
      metricOf({ kind: 'ratio', valueFormat: 'percent' }),
      { ...stats, baseline: 0.04, pointCount: 18 },
      '1h',
    );
    expect(tiles[1]?.footnote).toBe('prior 4.00%');
    expect(tiles[3]?.value).toBe('18');
  });

  it('leads an average metric with its mean', () => {
    const tiles = summaryTilesFor(
      metricOf({ kind: 'average', valueFormat: 'decimal' }),
      { ...stats, value: 41.8, baseline: 30 },
      '1h',
    );
    expect(tiles[0]?.label).toBe('Average over selection');
    expect(tiles[0]?.value).toBe('41.80');
  });

  it('carries the metric expression as the headline footnote', () => {
    const tiles = summaryTilesFor(metricOf({ expression: 'sum(order.total)' }), stats, '1h');
    expect(tiles[0]?.footnote).toBe('sum(order.total)');
  });
});
