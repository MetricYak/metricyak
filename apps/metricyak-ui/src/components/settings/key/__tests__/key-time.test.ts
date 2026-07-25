import { describe, expect, it } from 'vitest';
import { formatCountdown, formatLastUsed } from '../key-time';

const NOW = new Date('2026-07-25T12:00:00.000Z');

function ago(ms: number): string {
  return new Date(NOW.getTime() - ms).toISOString();
}

function ahead(ms: number): string {
  return new Date(NOW.getTime() + ms).toISOString();
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

describe('formatLastUsed', () => {
  it('reports a key that has never been used', () => {
    expect(formatLastUsed(null, NOW)).toBe('Never used');
  });

  it('reports very recent use without a number', () => {
    expect(formatLastUsed(ago(20_000), NOW)).toBe('Last used just now');
  });

  it('reports minutes', () => {
    expect(formatLastUsed(ago(3 * MINUTE), NOW)).toBe('Last used 3 minutes ago');
  });

  it('uses the singular for one minute', () => {
    expect(formatLastUsed(ago(MINUTE), NOW)).toBe('Last used 1 minute ago');
  });

  it('reports hours', () => {
    expect(formatLastUsed(ago(5 * HOUR), NOW)).toBe('Last used 5 hours ago');
  });

  it('reports days', () => {
    expect(formatLastUsed(ago(3 * DAY), NOW)).toBe('Last used 3 days ago');
  });

  it('falls back to a date beyond 30 days', () => {
    expect(formatLastUsed('2026-01-15T12:00:00.000Z', NOW)).toBe('Last used 15 Jan 2026');
  });

  it('treats a future timestamp as just now', () => {
    expect(formatLastUsed(ahead(5 * MINUTE), NOW)).toBe('Last used just now');
  });
});

describe('formatCountdown', () => {
  it('reports hours and minutes', () => {
    expect(formatCountdown(ahead(23 * HOUR + 12 * MINUTE), NOW)).toBe('23h 12m');
  });

  it('drops the hour segment under an hour', () => {
    expect(formatCountdown(ahead(12 * MINUTE), NOW)).toBe('12m');
  });

  it('reports less than a minute', () => {
    expect(formatCountdown(ahead(30_000), NOW)).toBe('less than a minute');
  });

  it('reports an elapsed deadline as expired', () => {
    expect(formatCountdown(ago(MINUTE), NOW)).toBe('expired');
  });
});
