import type { StoredEvent } from '@metricyak/queue';
import { OTHER_SENTINEL, TOTAL_SENTINEL } from '@metricyak/storage';
import { describe, expect, it } from 'vitest';
import {
  buildIngestDeltas,
  collectDimensionCandidates,
  type DimResolver,
  extractField,
  fieldPath,
} from '@/modules/aggregates/engine/ingest.js';
import type { MatcherMap, MatchTarget } from '@/modules/aggregates/engine/matcher.js';

const keepAll: DimResolver = (_m, _v, _d, raw) => raw;

const target = (overrides: Partial<MatchTarget> = {}): MatchTarget => ({
  metricId: 'm1',
  metricVersion: 1,
  eventKey: 'purchases',
  aggregation: 'count',
  field: null,
  dimensions: [],
  ...overrides,
});

const matcher = (targets: MatchTarget[]): MatcherMap => new Map([['purchase', targets]]);

const event = (
  properties: Record<string, unknown>,
  timestamp = '2025-01-15T12:00:30.000Z',
): StoredEvent => ({
  id: 'e1',
  insertId: null,
  name: 'purchase',
  timestamp,
  properties,
});

describe('fieldPath', () => {
  it('strips the $properties prefix and splits nested paths', () => {
    expect(fieldPath('$properties.amount_usd')).toEqual(['amount_usd']);
    expect(fieldPath('$properties.checkout.total')).toEqual(['checkout', 'total']);
    expect(fieldPath('amount')).toEqual(['amount']);
  });
});

describe('extractField', () => {
  it('reads a $properties path and coerces to a finite number', () => {
    expect(extractField({ amount_usd: '19.99' }, '$properties.amount_usd')).toBe(19.99);
    expect(extractField({ amount_usd: 'nope' }, '$properties.amount_usd')).toBeNull();
    expect(extractField({}, '$properties.missing')).toBeNull();
  });

  it('reads a nested $properties path', () => {
    expect(extractField({ checkout: { total: 42 } }, '$properties.checkout.total')).toBe(42);
    expect(extractField({ checkout: {} }, '$properties.checkout.total')).toBeNull();
  });
});

describe('buildIngestDeltas', () => {
  it('emits a total row and one row per declared dimension at minute grain', () => {
    const deltas = buildIngestDeltas(
      [event({ country: 'US' })],
      matcher([target({ dimensions: ['country'] })]),
      keepAll,
    );

    const total = deltas.find((d) => d.dimName === TOTAL_SENTINEL);
    const country = deltas.find((d) => d.dimName === 'country');
    expect(total?.count).toBe(1);
    expect(total?.bucketStart.toISOString()).toBe('2025-01-15T12:00:00.000Z');
    expect(country?.dimValue).toBe('US');
    expect(country?.count).toBe(1);
  });

  it('accumulates sum, min, and max across events in the same bucket', () => {
    const events = [
      event({ amount: 10 }, '2025-01-15T12:00:05.000Z'),
      event({ amount: 30 }, '2025-01-15T12:00:45.000Z'),
    ];

    const [sum] = buildIngestDeltas(
      events,
      matcher([target({ aggregation: 'sum', field: '$properties.amount' })]),
      keepAll,
    );
    expect(sum?.sum).toBe(40);
    expect(sum?.count).toBe(2);

    const [min] = buildIngestDeltas(
      events,
      matcher([target({ aggregation: 'min', field: '$properties.amount' })]),
      keepAll,
    );
    expect(min?.min).toBe(10);

    const [max] = buildIngestDeltas(
      events,
      matcher([target({ aggregation: 'max', field: '$properties.amount' })]),
      keepAll,
    );
    expect(max?.max).toBe(30);
  });

  it('spills dimension values the resolver rejects into the $other bucket', () => {
    const spillEverything: DimResolver = () => OTHER_SENTINEL;
    const deltas = buildIngestDeltas(
      [event({ country: 'US' })],
      matcher([target({ dimensions: ['country'] })]),
      spillEverything,
    );
    expect(deltas.find((d) => d.dimName === 'country')?.dimValue).toBe(OTHER_SENTINEL);
  });

  it('resolves a nested $properties path for a dimension', () => {
    const deltas = buildIngestDeltas(
      [event({ geo: { country: 'US' } })],
      matcher([target({ dimensions: ['$properties.geo.country'] })]),
      keepAll,
    );
    const nested = deltas.find((d) => d.dimName === '$properties.geo.country');
    expect(nested?.dimValue).toBe('US');
  });

  it('resolves an unprefixed nested dimension path', () => {
    const deltas = buildIngestDeltas(
      [event({ geo: { country: 'CA' } })],
      matcher([target({ dimensions: ['geo.country'] })]),
      keepAll,
    );
    const nested = deltas.find((d) => d.dimName === 'geo.country');
    expect(nested?.dimValue).toBe('CA');
  });

  it('skips a dimension when an intermediate path segment is missing', () => {
    const deltas = buildIngestDeltas(
      [event({ geo: {} })],
      matcher([target({ dimensions: ['geo.country'] })]),
      keepAll,
    );
    expect(deltas.find((d) => d.dimName === 'geo.country')).toBeUndefined();
  });
});

describe('collectDimensionCandidates', () => {
  it('groups distinct raw dimension values per metric and dimension', () => {
    const candidates = collectDimensionCandidates(
      [event({ country: 'US' }), event({ country: 'CA' }), event({ country: 'US' })],
      matcher([target({ dimensions: ['country'] })]),
    );
    const [candidate] = [...candidates.values()];
    expect(candidate?.dimName).toBe('country');
    expect([...(candidate?.values ?? [])].sort()).toEqual(['CA', 'US']);
  });

  it('truncates oversized dimension values to the column width', () => {
    const candidates = collectDimensionCandidates(
      [event({ country: 'x'.repeat(300) })],
      matcher([target({ dimensions: ['country'] })]),
    );
    const [candidate] = [...candidates.values()];
    const [value] = [...(candidate?.values ?? [])];
    expect(value?.length).toBe(256);
  });

  it('resolves nested $properties paths when collecting candidates', () => {
    const candidates = collectDimensionCandidates(
      [event({ geo: { country: 'US' } }), event({ geo: { country: 'CA' } })],
      matcher([target({ dimensions: ['$properties.geo.country'] })]),
    );
    const [candidate] = [...candidates.values()];
    expect(candidate?.dimName).toBe('$properties.geo.country');
    expect([...(candidate?.values ?? [])].sort()).toEqual(['CA', 'US']);
  });
});
