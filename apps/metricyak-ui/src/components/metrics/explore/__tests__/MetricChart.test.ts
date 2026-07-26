import { describe, expect, it } from 'vitest';
import { type MetricSeries, OTHER_DIM_VALUE } from '@/api/metric-series';
import { seriesLabel, toChartRows } from '@/components/metrics/explore/MetricChart';

function series(dimValue: string | null, values: readonly (number | null)[]): MetricSeries {
  return {
    dimValue,
    points: values.map((value, index) => ({
      start: new Date(Date.UTC(2026, 6, 26, index)).toISOString(),
      value,
    })),
  };
}

describe('toChartRows', () => {
  it('returns no rows when there is no series', () => {
    expect(toChartRows([], null)).toEqual([]);
  });

  it('emits one row per bucket keyed by series index', () => {
    const rows = toChartRows([series(null, [1, 2])], null);

    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual({ start: '2026-07-26T00:00:00.000Z', s0: 1 });
    expect(rows[1]).toEqual({ start: '2026-07-26T01:00:00.000Z', s0: 2 });
  });

  it('places every split series on the same row', () => {
    const rows = toChartRows([series('pro', [1, 2]), series('free', [3, 4])], null);

    expect(rows[0]).toMatchObject({ s0: 1, s1: 3 });
    expect(rows[1]).toMatchObject({ s0: 2, s1: 4 });
  });

  it('aligns the compare series by index, not by timestamp', () => {
    const previous: MetricSeries = {
      dimValue: null,
      points: [
        { start: '2026-07-19T00:00:00.000Z', value: 10 },
        { start: '2026-07-19T01:00:00.000Z', value: 20 },
      ],
    };

    const rows = toChartRows([series(null, [1, 2])], [previous]);

    expect(rows[0]).toEqual({ start: '2026-07-26T00:00:00.000Z', s0: 1, compare: 10 });
    expect(rows[1]).toEqual({ start: '2026-07-26T01:00:00.000Z', s0: 2, compare: 20 });
  });

  it('fills a short compare series with nulls rather than dropping rows', () => {
    const previous: MetricSeries = {
      dimValue: null,
      points: [{ start: '2026-07-19T00:00:00.000Z', value: 10 }],
    };

    const rows = toChartRows([series(null, [1, 2])], [previous]);

    expect(rows).toHaveLength(2);
    expect(rows[1]?.compare).toBeNull();
  });

  it('carries nulls through so gaps stay gaps', () => {
    const rows = toChartRows([series(null, [null, 5])], null);

    expect(rows[0]?.s0).toBeNull();
  });
});

describe('seriesLabel', () => {
  it('names the unsplit series after the metric', () => {
    expect(seriesLabel(series(null, [1]), 'Checkout revenue')).toBe('Checkout revenue');
  });

  it('renders the folded bucket as Other rather than its sentinel', () => {
    expect(seriesLabel(series(OTHER_DIM_VALUE, [1]), 'Checkout revenue')).toBe('Other');
  });

  it('uses the dimension value for a normal split series', () => {
    expect(seriesLabel(series('pro', [1]), 'Checkout revenue')).toBe('pro');
  });
});
