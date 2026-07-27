import { describe, expect, it } from 'vitest';
import { baselineGuideCaption, baselineGuideValue } from '../baseline-guide';

const HOUR_MS = 60 * 60_000;
const DAY_MS = 24 * HOUR_MS;

describe('baselineGuideValue', () => {
  it('spreads an additive prior total across the buckets of the window', () => {
    expect(
      baselineGuideValue({
        kind: 'count',
        baseline: 2400,
        windowSpanMs: DAY_MS,
        bucketMs: HOUR_MS,
      }),
    ).toBe(100);
  });

  it('spreads a summed prior total the same way', () => {
    expect(
      baselineGuideValue({
        kind: 'sum',
        baseline: 50,
        windowSpanMs: 10 * HOUR_MS,
        bucketMs: HOUR_MS,
      }),
    ).toBe(5);
  });

  it('leaves a level metric on the scale the buckets already use', () => {
    for (const kind of ['average', 'min', 'max', 'ratio'] as const) {
      expect(
        baselineGuideValue({ kind, baseline: 0.42, windowSpanMs: DAY_MS, bucketMs: HOUR_MS }),
      ).toBe(0.42);
    }
  });

  it('has no guide when there is no prior value', () => {
    expect(
      baselineGuideValue({
        kind: 'count',
        baseline: null,
        windowSpanMs: DAY_MS,
        bucketMs: HOUR_MS,
      }),
    ).toBeNull();
  });

  it('has no guide for an additive metric when the window holds no buckets', () => {
    expect(
      baselineGuideValue({ kind: 'count', baseline: 2400, windowSpanMs: 0, bucketMs: HOUR_MS }),
    ).toBeNull();
    expect(
      baselineGuideValue({ kind: 'count', baseline: 2400, windowSpanMs: DAY_MS, bucketMs: 0 }),
    ).toBeNull();
  });

  it('keeps a fractional bucket count rather than rounding it away', () => {
    expect(
      baselineGuideValue({
        kind: 'count',
        baseline: 300,
        windowSpanMs: 2.5 * HOUR_MS,
        bucketMs: HOUR_MS,
      }),
    ).toBe(120);
  });
});

describe('baselineGuideCaption', () => {
  it('names the bucket the additive guide was averaged over', () => {
    expect(baselineGuideCaption('count', 'Checkout errors', '1h')).toBe(
      "The dashed line is the prior window's average checkout errors per hour.",
    );
  });

  it('claims no averaging for a level metric', () => {
    expect(baselineGuideCaption('ratio', 'Conversion rate', '1d')).toBe(
      "The dashed line is the prior window's conversion rate.",
    );
  });
});
