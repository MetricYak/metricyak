import { describe, expect, it } from 'vitest';
import { CreateMetricRequest } from '@/modules/metrics/metrics.schemas.js';

const parse = (definition: unknown) =>
  CreateMetricRequest.safeParse({ name: 'Metric', definition });

describe('CreateMetricRequest', () => {
  it('accepts a single-event definition', () => {
    const result = parse({
      events: [{ key: 'signups', source: 'app', type: 'signup', aggregation: 'count' }],
    });
    expect(result.success).toBe(true);
  });

  it('accepts min/max aggregations with a field', () => {
    const result = parse({
      events: [
        { key: 'latency', source: 'app', type: 'req', aggregation: 'max', field: '$properties.ms' },
      ],
    });
    expect(result.success).toBe(true);
  });

  it('accepts declared dimensions', () => {
    const result = parse({
      events: [{ key: 'signups', source: 'app', type: 'signup', aggregation: 'count' }],
      dimensions: ['country', 'plan'],
    });
    expect(result.success).toBe(true);
  });

  it('requires a value expression when a metric has more than one event', () => {
    const result = parse({
      events: [
        { key: 'a', source: 'app', type: 'x', aggregation: 'count' },
        { key: 'b', source: 'app', type: 'y', aggregation: 'count' },
      ],
    });
    expect(result.success).toBe(false);
  });

  it('rejects a value expression that references an unknown key', () => {
    const result = parse({
      value: 'a + missing',
      events: [
        { key: 'a', source: 'app', type: 'x', aggregation: 'count' },
        { key: 'b', source: 'app', type: 'y', aggregation: 'count' },
      ],
    });
    expect(result.success).toBe(false);
  });
});
