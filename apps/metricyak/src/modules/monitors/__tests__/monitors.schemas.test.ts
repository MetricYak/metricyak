import type { MetricDefinition } from '@metricyak/storage';
import { describe, expect, it } from 'vitest';
import {
  CreateMonitorRequest,
  isEqualityOperator,
  metricYieldsIntegerValues,
  UpdateMonitorRequest,
} from '@/modules/monitors/monitors.schemas.js';

const metricId = 'd6ceaf26-fd71-4c38-90f1-2de20b946d00';

function countEvent(key: string): MetricDefinition['events'][number] {
  return { key, source: 'posthog', type: 'completed.signup', aggregation: 'count' };
}

function sumEvent(key: string): MetricDefinition['events'][number] {
  return { key, source: 'stripe', type: 'charge', aggregation: 'sum', field: '$properties.amount' };
}

describe('CreateMonitorRequest', () => {
  const validBody = {
    name: 'Daily revenue floor',
    metricId,
    condition: { operator: 'lt', value: 5000 },
    window: '1d',
    holdFor: '0m',
  };

  it('applies defaults for enabled and missingData', () => {
    const parsed = CreateMonitorRequest.parse(validBody);
    expect(parsed.enabled).toBe(true);
    expect(parsed.missingData).toBe('skip');
  });

  it('accepts explicit enabled and missingData', () => {
    const parsed = CreateMonitorRequest.parse({
      ...validBody,
      enabled: false,
      missingData: 'fire',
    });
    expect(parsed.enabled).toBe(false);
    expect(parsed.missingData).toBe('fire');
  });

  it('rejects an unknown comparison operator', () => {
    const result = CreateMonitorRequest.safeParse({
      ...validBody,
      condition: { operator: 'between', value: 1 },
    });
    expect(result.success).toBe(false);
  });

  it('rejects an unknown missingData policy', () => {
    const result = CreateMonitorRequest.safeParse({ ...validBody, missingData: 'ignore' });
    expect(result.success).toBe(false);
  });

  it('rejects a malformed window duration', () => {
    const result = CreateMonitorRequest.safeParse({ ...validBody, window: '1 day' });
    expect(result.success).toBe(false);
  });

  it('rejects a non-uuid metricId', () => {
    const result = CreateMonitorRequest.safeParse({ ...validBody, metricId: 'not-a-uuid' });
    expect(result.success).toBe(false);
  });

  it('rejects a non-numeric threshold value', () => {
    const result = CreateMonitorRequest.safeParse({
      ...validBody,
      condition: { operator: 'lt', value: 'high' },
    });
    expect(result.success).toBe(false);
  });
});

describe('UpdateMonitorRequest', () => {
  it('accepts an empty patch', () => {
    expect(UpdateMonitorRequest.parse({})).toEqual({});
  });

  it('accepts a partial patch of a single field', () => {
    expect(UpdateMonitorRequest.parse({ enabled: false })).toEqual({ enabled: false });
  });

  it('rejects an unknown comparison operator', () => {
    const result = UpdateMonitorRequest.safeParse({ condition: { operator: 'between', value: 1 } });
    expect(result.success).toBe(false);
  });
});

describe('isEqualityOperator', () => {
  it('is true for eq and neq', () => {
    expect(isEqualityOperator('eq')).toBe(true);
    expect(isEqualityOperator('neq')).toBe(true);
  });

  it('is false for ordering operators', () => {
    expect(isEqualityOperator('lt')).toBe(false);
    expect(isEqualityOperator('lte')).toBe(false);
    expect(isEqualityOperator('gt')).toBe(false);
    expect(isEqualityOperator('gte')).toBe(false);
  });
});

describe('metricYieldsIntegerValues', () => {
  it('is true when every event is a count and no value expression divides', () => {
    expect(metricYieldsIntegerValues({ events: [countEvent('signups')] })).toBe(true);
    expect(
      metricYieldsIntegerValues({
        events: [countEvent('signups'), countEvent('logins')],
        value: 'signups + logins',
      }),
    ).toBe(true);
  });

  it('is false when any event is a non-count aggregation', () => {
    expect(metricYieldsIntegerValues({ events: [sumEvent('revenue')] })).toBe(false);
    expect(
      metricYieldsIntegerValues({ events: [countEvent('signups'), sumEvent('revenue')] }),
    ).toBe(false);
  });

  it('is false when the value expression divides counts into a ratio', () => {
    expect(
      metricYieldsIntegerValues({
        events: [countEvent('signups'), countEvent('visits')],
        value: 'signups / visits',
      }),
    ).toBe(false);
  });
});
