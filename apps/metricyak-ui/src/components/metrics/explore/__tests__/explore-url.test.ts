import { describe, expect, it } from 'vitest';
import { readExploreState, writeExploreState } from '@/components/metrics/explore/explore-url';

describe('explore url state', () => {
  it('round-trips a full state', () => {
    const state = {
      metricId: 'm1',
      range: '7d' as const,
      granularity: '1h' as const,
      splitBy: 'plan',
      filters: [{ name: 'plan', value: 'pro' }],
      compare: false,
      selection: { from: '2026-07-26T00:00:00.000Z', to: '2026-07-26T01:00:00.000Z' },
    };
    expect(readExploreState(writeExploreState(state))).toEqual(state);
  });

  it('reads defaults from an empty query', () => {
    const state = readExploreState(new URLSearchParams());
    expect(state.metricId).toBeNull();
    expect(state.range).toBe('24h');
    expect(state.granularity).toBeNull();
    expect(state.splitBy).toBeNull();
    expect(state.filters).toEqual([]);
    expect(state.compare).toBe(false);
    expect(state.selection).toBeNull();
  });

  it('keeps values containing colons intact', () => {
    const params = writeExploreState({
      metricId: 'm1',
      range: '24h',
      granularity: null,
      splitBy: null,
      filters: [{ name: 'url', value: 'https://x.test/a' }],
      compare: false,
      selection: null,
    });
    expect(readExploreState(params).filters).toEqual([{ name: 'url', value: 'https://x.test/a' }]);
  });

  it('drops splitBy when compare is on', () => {
    const params = writeExploreState({
      metricId: 'm1',
      range: '24h',
      granularity: null,
      splitBy: 'plan',
      filters: [],
      compare: true,
      selection: null,
    });
    const state = readExploreState(params);
    expect(state.compare).toBe(true);
    expect(state.splitBy).toBeNull();
  });

  it('falls back to the default range for an unknown or all-time range', () => {
    expect(readExploreState(new URLSearchParams('range=nonsense')).range).toBe('24h');
    expect(readExploreState(new URLSearchParams('range=all')).range).toBe('24h');
  });

  it('ignores an unknown granularity', () => {
    expect(readExploreState(new URLSearchParams('g=2h')).granularity).toBeNull();
  });

  it('ignores a malformed filter', () => {
    expect(readExploreState(new URLSearchParams('f=plan&f=:pro&f=plan:')).filters).toEqual([]);
  });

  it('ignores a malformed selection', () => {
    expect(
      readExploreState(new URLSearchParams('sel=2026-07-26T00:00:00.000Z')).selection,
    ).toBeNull();
  });
});
