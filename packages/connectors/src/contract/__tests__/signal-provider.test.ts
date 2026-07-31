import { describe, expect, it } from 'vitest';
import { SIGNAL_KINDS, SIGNAL_PROVIDER_IDS } from '@/contract/signal-provider.js';

describe('signal contract', () => {
  it('names every signal kind the storage layer persists', () => {
    expect(SIGNAL_KINDS).toEqual(['deployment', 'flag_change', 'incident']);
  });

  it('names every provider the registry can hold', () => {
    expect(SIGNAL_PROVIDER_IDS).toEqual(['github']);
  });
});
