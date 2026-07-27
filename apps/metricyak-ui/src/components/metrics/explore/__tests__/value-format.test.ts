import { describe, expect, it } from 'vitest';
import {
  changeDirection,
  formatAbsoluteChange,
  formatChangeRatio,
  formatCount,
  formatMetricAmount,
} from '../value-format';

describe('formatMetricAmount', () => {
  it('renders an em dash for a missing or non-finite value', () => {
    expect(formatMetricAmount(null, 'decimal')).toBe('—');
    expect(formatMetricAmount(Number.NaN, 'decimal')).toBe('—');
    expect(formatMetricAmount(Number.POSITIVE_INFINITY, 'integer')).toBe('—');
  });

  it('rounds integers and keeps decimals', () => {
    expect(formatMetricAmount(1234.6, 'integer')).toBe('1,235');
    expect(formatMetricAmount(41.837, 'decimal')).toBe('41.84');
  });

  it('scales a percentage format by a hundred', () => {
    expect(formatMetricAmount(0.0315, 'percent')).toBe('3.15%');
  });
});

describe('formatAbsoluteChange', () => {
  it('signs the change and uses points for percentages', () => {
    expect(formatAbsoluteChange(0.0072, 'percent')).toBe('+0.72 pp');
    expect(formatAbsoluteChange(-0.0072, 'percent')).toBe('−0.72 pp');
    expect(formatAbsoluteChange(-18, 'integer')).toBe('−18');
    expect(formatAbsoluteChange(null, 'decimal')).toBe('—');
  });
});

describe('formatChangeRatio', () => {
  it('renders a signed percentage or an em dash', () => {
    expect(formatChangeRatio(-0.222)).toBe('−22.2%');
    expect(formatChangeRatio(0.064)).toBe('+6.4%');
    expect(formatChangeRatio(null)).toBe('—');
  });
});

describe('changeDirection', () => {
  it('treats a missing or tiny change as flat', () => {
    expect(changeDirection(null)).toBe('flat');
    expect(changeDirection(0.001)).toBe('flat');
  });

  it('names the direction of a real change', () => {
    expect(changeDirection(0.2)).toBe('up');
    expect(changeDirection(-0.2)).toBe('down');
  });
});

describe('formatCount', () => {
  it('groups thousands', () => {
    expect(formatCount(12450)).toBe('12,450');
  });
});
