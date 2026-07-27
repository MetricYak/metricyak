import { describe, expect, it } from 'vitest';
import {
  DEFAULT_EXPLORE_WINDOW,
  type ExploreState,
  readExploreState,
  resolveWindow,
  writeExploreState,
} from '@/components/metrics/explore/explore-url';

const NOW_MS = Date.UTC(2026, 6, 27, 11, 0);
const HOUR_MS = 3_600_000;

function read(query: string): ExploreState {
  return readExploreState(new URLSearchParams(query));
}

describe('readExploreState', () => {
  it('falls back to the default window when the range is missing or unknown', () => {
    expect(read('').window).toEqual(DEFAULT_EXPLORE_WINDOW);
    expect(read('range=fortnight').window).toEqual(DEFAULT_EXPLORE_WINDOW);
  });

  it('reads a custom window from epoch milliseconds', () => {
    expect(read(`range=custom&from=${NOW_MS - HOUR_MS}&to=${NOW_MS}`).window).toEqual({
      kind: 'custom',
      fromMs: NOW_MS - HOUR_MS,
      toMs: NOW_MS,
    });
  });

  it('rejects a custom window that ends before it starts', () => {
    expect(read(`range=custom&from=${NOW_MS}&to=${NOW_MS - HOUR_MS}`).window).toEqual(
      DEFAULT_EXPLORE_WINDOW,
    );
  });

  it('drops a selection that is not a forward range', () => {
    expect(read(`sel=${NOW_MS}..${NOW_MS}`).selection).toBeNull();
    expect(read('sel=nonsense').selection).toBeNull();
    expect(read(`sel=${NOW_MS - HOUR_MS}..${NOW_MS}`).selection).toEqual({
      fromMs: NOW_MS - HOUR_MS,
      toMs: NOW_MS,
    });
  });

  it('keeps only well-formed filters', () => {
    expect(read('f=country:DE&f=broken&f=:DE&f=country:').filters).toEqual([
      { name: 'country', value: 'DE' },
    ]);
  });

  it('defaults to the breakdown tab for an unknown tab', () => {
    expect(read('tab=wat').tab).toBe('breakdown');
    expect(read('tab=events').tab).toBe('events');
  });

  it('ignores a granularity the chart cannot render', () => {
    expect(read('g=3y').granularity).toBeNull();
    expect(read('g=4h').granularity).toBe('4h');
  });
});

describe('writeExploreState', () => {
  it('round-trips every field', () => {
    const state: ExploreState = {
      metricId: 'checkout-conversion-rate',
      window: { kind: 'custom', fromMs: NOW_MS - HOUR_MS, toMs: NOW_MS },
      granularity: '5m',
      filters: [
        { name: 'country', value: 'DE' },
        { name: 'payment_method', value: 'card_3ds' },
      ],
      selection: { fromMs: NOW_MS - HOUR_MS / 2, toMs: NOW_MS },
      tab: 'events',
      property: 'country',
    };

    expect(readExploreState(writeExploreState(state))).toEqual(state);
  });

  it('leaves the default tab out of the query string', () => {
    const params = writeExploreState({
      metricId: null,
      window: DEFAULT_EXPLORE_WINDOW,
      granularity: null,
      filters: [],
      selection: null,
      tab: 'breakdown',
      property: null,
    });
    expect(params.has('tab')).toBe(false);
  });
});

describe('resolveWindow', () => {
  it('turns a preset into an absolute span ending now', () => {
    expect(resolveWindow({ kind: 'preset', range: '24h' }, NOW_MS)).toEqual({
      fromMs: NOW_MS - 24 * HOUR_MS,
      toMs: NOW_MS,
    });
  });

  it('passes a custom window through untouched', () => {
    const window = { kind: 'custom', fromMs: 1, toMs: 2 } as const;
    expect(resolveWindow(window, NOW_MS)).toEqual({ fromMs: 1, toMs: 2 });
  });
});
