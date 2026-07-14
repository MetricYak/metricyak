import { describe, expect, it } from 'vitest';
import { parseDuration } from '../duration.js';

describe('parseDuration', () => {
  it('parses each unit into milliseconds', () => {
    expect(parseDuration('30s')).toBe(30_000);
    expect(parseDuration('5m')).toBe(300_000);
    expect(parseDuration('1h')).toBe(3_600_000);
    expect(parseDuration('1d')).toBe(86_400_000);
    expect(parseDuration('1w')).toBe(604_800_000);
  });

  it('treats a zero duration as zero milliseconds', () => {
    expect(parseDuration('0m')).toBe(0);
  });

  it('throws on an unparseable duration', () => {
    expect(() => parseDuration('1y')).toThrow('Invalid duration');
    expect(() => parseDuration('abc')).toThrow('Invalid duration');
  });
});
