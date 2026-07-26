import { describe, expect, it } from 'vitest';
import type { MetricAggregation, MetricEvent } from '@/api/metrics';
import { yDomainFor } from '@/components/metrics/explore/y-domain';

const event = (aggregation: MetricAggregation): MetricEvent => ({
  key: 'k',
  source: 'events',
  type: 't',
  aggregation,
});

describe('yDomainFor', () => {
  it('zero-baselines a count metric', () => {
    expect(yDomainFor({ events: [event('count')] })).toEqual([0, 'auto']);
  });

  it('zero-baselines when any event is a sum', () => {
    expect(yDomainFor({ events: [event('average'), event('sum')] })).toEqual([0, 'auto']);
  });

  it('fits the data range when every event is an average', () => {
    expect(yDomainFor({ events: [event('average')] })).toEqual(['auto', 'auto']);
  });

  it('fits the data range for min and max metrics', () => {
    expect(yDomainFor({ events: [event('min'), event('max')] })).toEqual(['auto', 'auto']);
  });
});
