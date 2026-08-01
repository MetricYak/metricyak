import { describe, expect, it } from 'vitest';
import type { SignalSource } from '@/api/signal-sources';
import {
  deriveSourceStatus,
  formatLastDelivery,
  matchesSourceQuery,
} from '@/components/data/deployment-source-view';

const NOW = new Date('2026-08-01T12:00:00.000Z');

function isoMinutesAgo(minutes: number): string {
  return new Date(NOW.getTime() - minutes * 60_000).toISOString();
}

function sourceWith(overrides: Partial<SignalSource>): SignalSource {
  return {
    id: 'src_1',
    name: 'acme/web',
    provider: 'github',
    config: {},
    status: 'healthy',
    lastDeliveryAt: null,
    lastError: null,
    secretConfigured: true,
    webhookUrl: 'https://example.test/hook',
    createdAt: NOW.toISOString(),
    ...overrides,
  };
}

describe('deriveSourceStatus', () => {
  it('reads healthy as receiving', () => {
    expect(deriveSourceStatus('healthy')).toEqual({ label: 'Receiving', tone: 'ok' });
  });

  it('reads a source with no deliveries as waiting', () => {
    expect(deriveSourceStatus('awaiting_first_delivery')).toEqual({
      label: 'Waiting for first deploy',
      tone: 'pending',
    });
  });

  it('reads failing as an error', () => {
    expect(deriveSourceStatus('failing')).toEqual({ label: 'Not working', tone: 'error' });
  });
});

describe('formatLastDelivery', () => {
  it('says nothing yet when there has never been a delivery', () => {
    expect(formatLastDelivery(null, NOW)).toBe('Nothing yet');
  });

  it('collapses the last minute to just now', () => {
    expect(formatLastDelivery(isoMinutesAgo(0.5), NOW)).toBe('Just now');
  });

  it('counts minutes, then hours, then days', () => {
    expect(formatLastDelivery(isoMinutesAgo(8), NOW)).toBe('8 minutes ago');
    expect(formatLastDelivery(isoMinutesAgo(60 * 3), NOW)).toBe('3 hours ago');
    expect(formatLastDelivery(isoMinutesAgo(60 * 24 * 4), NOW)).toBe('4 days ago');
  });

  it('uses the singular for one unit', () => {
    expect(formatLastDelivery(isoMinutesAgo(1), NOW)).toBe('1 minute ago');
    expect(formatLastDelivery(isoMinutesAgo(60), NOW)).toBe('1 hour ago');
    expect(formatLastDelivery(isoMinutesAgo(60 * 24), NOW)).toBe('1 day ago');
  });

  it('falls back to an absolute date past thirty days', () => {
    expect(formatLastDelivery(isoMinutesAgo(60 * 24 * 31), NOW)).toBe('1 Jul 2026');
  });
});

describe('matchesSourceQuery', () => {
  const source = sourceWith({ name: 'acme/web', provider: 'github' });

  it('matches everything on an empty or whitespace query', () => {
    expect(matchesSourceQuery(source, '')).toBe(true);
    expect(matchesSourceQuery(source, '   ')).toBe(true);
  });

  it('matches on name and provider, ignoring case', () => {
    expect(matchesSourceQuery(source, 'ACME')).toBe(true);
    expect(matchesSourceQuery(source, 'GitHub')).toBe(true);
  });

  it('rejects a query that appears in neither', () => {
    expect(matchesSourceQuery(source, 'gitlab')).toBe(false);
  });
});
