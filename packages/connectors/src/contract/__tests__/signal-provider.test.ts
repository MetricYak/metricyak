import { describe, expect, it } from 'vitest';
import {
  isAllowedSignalStatus,
  SIGNAL_KINDS,
  SIGNAL_PROVIDER_IDS,
} from '@/contract/signal-provider.js';

describe('signal contract', () => {
  it('names every signal kind the storage layer persists', () => {
    expect(SIGNAL_KINDS).toEqual(['deployment', 'flag_change', 'incident']);
  });

  it('names every provider the registry can hold', () => {
    expect(SIGNAL_PROVIDER_IDS).toEqual(['github']);
  });
});

describe('isAllowedSignalStatus', () => {
  it('accepts a status the kind declares', () => {
    expect(isAllowedSignalStatus('deployment', 'succeeded')).toBe(true);
    expect(isAllowedSignalStatus('incident', 'resolved')).toBe(true);
  });

  it('rejects a status borrowed from another kind', () => {
    expect(isAllowedSignalStatus('deployment', 'resolved')).toBe(false);
    expect(isAllowedSignalStatus('incident', 'succeeded')).toBe(false);
  });

  it('rejects an invented status', () => {
    expect(isAllowedSignalStatus('deployment', 'rolled_back')).toBe(false);
  });

  it('requires no status for a kind that declares none', () => {
    expect(isAllowedSignalStatus('flag_change', null)).toBe(true);
    expect(isAllowedSignalStatus('flag_change', 'enabled')).toBe(false);
  });

  it('requires a status for a kind that declares some', () => {
    expect(isAllowedSignalStatus('deployment', null)).toBe(false);
  });
});
