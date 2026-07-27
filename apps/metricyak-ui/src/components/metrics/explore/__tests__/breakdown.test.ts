import { describe, expect, it } from 'vitest';
import { breakdownRows, largestChange } from '../breakdown';

const current = [
  { dimValue: 'card_3ds', value: 40 },
  { dimValue: 'card', value: 120 },
  { dimValue: 'paypal', value: 60 },
];
const prior = [
  { dimValue: 'card_3ds', value: 118 },
  { dimValue: 'card', value: 110 },
  { dimValue: 'paypal', value: 62 },
];

describe('breakdownRows', () => {
  it('ranks values by the size of their change', () => {
    const rows = breakdownRows({ kind: 'count', current, prior });
    expect(rows.map((row) => row.value)).toEqual(['card_3ds', 'card', 'paypal']);
  });

  it('reports each value against its prior level', () => {
    const [first] = breakdownRows({ kind: 'count', current, prior });
    expect(first?.current).toBe(40);
    expect(first?.prior).toBe(118);
    expect(first?.change).toBe(-78);
    expect(first?.changeRatio).toBeCloseTo(-78 / 118);
  });

  it('attributes a share of the total change for an additive metric', () => {
    const [first] = breakdownRows({ kind: 'count', current, prior });
    expect(first?.shareOfChange).toBeCloseTo(-78 / -70);
  });

  it('attributes no share for a ratio metric', () => {
    const rows = breakdownRows({ kind: 'ratio', current, prior });
    expect(rows.every((row) => row.shareOfChange === null)).toBe(true);
  });

  it('attributes no share when the totals did not move', () => {
    const rows = breakdownRows({
      kind: 'count',
      current: [
        { dimValue: 'a', value: 10 },
        { dimValue: 'b', value: 20 },
      ],
      prior: [
        { dimValue: 'a', value: 20 },
        { dimValue: 'b', value: 10 },
      ],
    });
    expect(rows.every((row) => row.shareOfChange === null)).toBe(true);
  });

  it('reads a value missing from one side of an additive metric as zero', () => {
    const rows = breakdownRows({
      kind: 'count',
      current: [{ dimValue: 'new_value', value: 12 }],
      prior: [{ dimValue: 'gone_value', value: 9 }],
    });
    const appeared = rows.find((row) => row.value === 'new_value');
    const vanished = rows.find((row) => row.value === 'gone_value');
    expect(appeared?.prior).toBe(0);
    expect(appeared?.change).toBe(12);
    expect(vanished?.current).toBe(0);
    expect(vanished?.change).toBe(-9);
  });

  it.each([
    'ratio',
    'average',
    'min',
    'max',
  ] as const)('keeps a value that appears on only one side of a %s metric uncompared', (kind) => {
    const rows = breakdownRows({
      kind,
      current: [{ dimValue: 'new_value', value: 12 }],
      prior: [{ dimValue: 'gone_value', value: 9 }],
    });
    const appeared = rows.find((row) => row.value === 'new_value');
    const vanished = rows.find((row) => row.value === 'gone_value');
    expect(appeared?.prior).toBeNull();
    expect(appeared?.change).toBeNull();
    expect(vanished?.current).toBeNull();
    expect(vanished?.change).toBeNull();
  });

  it('reads an explicitly unknown level as unknown rather than zero', () => {
    const rows = breakdownRows({
      kind: 'count',
      current: [{ dimValue: 'a', value: null }],
      prior: [{ dimValue: 'a', value: 5 }],
    });
    expect(rows[0]?.current).toBeNull();
    expect(rows[0]?.change).toBeNull();
  });

  it('has no change ratio when the prior level was zero', () => {
    const rows = breakdownRows({
      kind: 'count',
      current: [{ dimValue: 'a', value: 5 }],
      prior: [{ dimValue: 'a', value: 0 }],
    });
    expect(rows[0]?.change).toBe(5);
    expect(rows[0]?.changeRatio).toBeNull();
  });

  it('measures the change ratio against the magnitude of a negative prior', () => {
    const rows = breakdownRows({
      kind: 'sum',
      current: [{ dimValue: 'a', value: -50 }],
      prior: [{ dimValue: 'a', value: -100 }],
    });
    expect(rows[0]?.change).toBe(50);
    expect(rows[0]?.changeRatio).toBeCloseTo(0.5);
  });

  it('attributes shares that add up to the whole change', () => {
    const rows = breakdownRows({ kind: 'count', current, prior });
    const shares = rows.map((row) => row.shareOfChange ?? 0);
    expect(shares.reduce((total, share) => total + share, 0)).toBeCloseTo(1);
  });

  it('attributes an offsetting rise a negative share', () => {
    const rows = breakdownRows({ kind: 'count', current, prior });
    expect(rows.find((row) => row.value === 'card')?.shareOfChange).toBeCloseTo(10 / -70);
  });

  it('attributes a share for a sum metric', () => {
    const rows = breakdownRows({
      kind: 'sum',
      current: [{ dimValue: 'a', value: 30 }],
      prior: [{ dimValue: 'a', value: 10 }],
    });
    expect(rows[0]?.shareOfChange).toBeCloseTo(1);
  });

  it.each(['average', 'min', 'max'] as const)('attributes no share for a %s metric', (kind) => {
    const rows = breakdownRows({ kind, current, prior });
    expect(rows.every((row) => row.shareOfChange === null)).toBe(true);
  });

  it('attributes no share when opposing movements swamp the net change', () => {
    const rows = breakdownRows({
      kind: 'count',
      current: [
        { dimValue: 'a', value: 100 },
        { dimValue: 'b', value: 1 },
      ],
      prior: [
        { dimValue: 'a', value: 50 },
        { dimValue: 'b', value: 50 },
      ],
    });
    expect(rows.every((row) => row.shareOfChange === null)).toBe(true);
  });

  it('attributes no share when rounding leaves the net change as a residue', () => {
    const rows = breakdownRows({
      kind: 'sum',
      current: [
        { dimValue: 'a', value: 0.1 },
        { dimValue: 'b', value: 0.2 },
      ],
      prior: [
        { dimValue: 'a', value: 0.3 },
        { dimValue: 'b', value: 0 },
      ],
    });
    expect(rows.every((row) => row.shareOfChange === null)).toBe(true);
  });

  it('attributes the whole change to a value that only the current window reported', () => {
    const rows = breakdownRows({
      kind: 'count',
      current: [
        { dimValue: 'steady', value: 100 },
        { dimValue: 'appeared', value: 40 },
      ],
      prior: [{ dimValue: 'steady', value: 100 }],
    });
    const appeared = rows.find((row) => row.value === 'appeared');
    expect(appeared?.change).toBe(40);
    expect(appeared?.shareOfChange).toBeCloseTo(1);
    expect(appeared?.changeRatio).toBeNull();
    expect(rows.find((row) => row.value === 'steady')?.shareOfChange).toBe(0);
  });

  it('attributes no share while a value is missing from one side of a ratio metric', () => {
    const rows = breakdownRows({
      kind: 'ratio',
      current: [
        { dimValue: 'a', value: 10 },
        { dimValue: 'appeared', value: 40 },
      ],
      prior: [{ dimValue: 'a', value: 60 }],
    });
    expect(rows.every((row) => row.shareOfChange === null)).toBe(true);
  });

  it('attributes no share when a value is reported as unknown', () => {
    const rows = breakdownRows({
      kind: 'count',
      current: [
        { dimValue: 'a', value: 10 },
        { dimValue: 'b', value: null },
      ],
      prior: [
        { dimValue: 'a', value: 60 },
        { dimValue: 'b', value: 5 },
      ],
    });
    expect(rows.every((row) => row.shareOfChange === null)).toBe(true);
  });

  it('ranks a value with no comparable change below one that did not move', () => {
    const rows = breakdownRows({
      kind: 'average',
      current: [
        { dimValue: 'appeared', value: 40 },
        { dimValue: 'flat', value: 7 },
      ],
      prior: [{ dimValue: 'flat', value: 7 }],
    });
    expect(rows.map((row) => row.value)).toEqual(['flat', 'appeared']);
  });

  it('ranks values with no comparable change by their level', () => {
    const rows = breakdownRows({
      kind: 'average',
      current: [
        { dimValue: 'small', value: 3 },
        { dimValue: 'large', value: 30 },
      ],
      prior: [{ dimValue: 'vanished', value: 12 }],
    });
    expect(rows.map((row) => row.value)).toEqual(['large', 'vanished', 'small']);
  });

  it('ranks a value that appeared in an additive metric by the change it brought', () => {
    const rows = breakdownRows({
      kind: 'count',
      current: [
        { dimValue: 'appeared', value: 40 },
        { dimValue: 'nudged', value: 9 },
      ],
      prior: [{ dimValue: 'nudged', value: 7 }],
    });
    expect(rows.map((row) => row.value)).toEqual(['appeared', 'nudged']);
  });

  it('orders equal changes by dimension value', () => {
    const rows = breakdownRows({
      kind: 'count',
      current: [
        { dimValue: 'zeta', value: 15 },
        { dimValue: 'alpha', value: 15 },
      ],
      prior: [
        { dimValue: 'zeta', value: 10 },
        { dimValue: 'alpha', value: 10 },
      ],
    });
    expect(rows.map((row) => row.value)).toEqual(['alpha', 'zeta']);
  });

  it('reports every dimension value from both windows once', () => {
    const rows = breakdownRows({
      kind: 'count',
      current: [{ dimValue: 'a', value: 1 }],
      prior: [
        { dimValue: 'a', value: 2 },
        { dimValue: 'b', value: 3 },
      ],
    });
    expect(rows.map((row) => row.value).sort()).toEqual(['a', 'b']);
  });

  it('has no rows when neither window reported anything', () => {
    expect(breakdownRows({ kind: 'count', current: [], prior: [] })).toEqual([]);
  });
});

describe('largestChange', () => {
  it('is the widest absolute change across the rows', () => {
    expect(largestChange(breakdownRows({ kind: 'count', current, prior }))).toBe(78);
  });

  it('is zero when nothing is comparable', () => {
    expect(largestChange([])).toBe(0);
  });

  it('ignores values that have no comparable change', () => {
    const rows = breakdownRows({
      kind: 'average',
      current: [
        { dimValue: 'appeared', value: 900 },
        { dimValue: 'a', value: 14 },
      ],
      prior: [{ dimValue: 'a', value: 10 }],
    });
    expect(largestChange(rows)).toBe(4);
  });

  it('counts the change a value brought when it appeared in an additive metric', () => {
    const rows = breakdownRows({
      kind: 'count',
      current: [
        { dimValue: 'appeared', value: 900 },
        { dimValue: 'a', value: 14 },
      ],
      prior: [{ dimValue: 'a', value: 10 }],
    });
    expect(largestChange(rows)).toBe(900);
  });
});
