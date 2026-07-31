import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { findSignalProvider, signalProviders } from '@/registry.js';

const SECRET = 'whsec_conformance';

function signed(body: string): Headers {
  return new Headers({
    'x-hub-signature-256': `sha256=${createHmac('sha256', SECRET).update(body).digest('hex')}`,
  });
}

describe('registry', () => {
  it('holds at least one provider', () => {
    expect(signalProviders.length).toBeGreaterThan(0);
  });

  it('finds a provider by id', () => {
    expect(findSignalProvider('github')?.provider).toBe('github');
  });

  it('returns null for an unknown provider', () => {
    expect(findSignalProvider('nope')).toBeNull();
  });

  it('has no duplicate provider ids', () => {
    const ids = signalProviders.map((provider) => provider.provider);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe.each(
  signalProviders.map((provider) => [provider.provider, provider] as const),
)('conformance: %s', (_id, provider) => {
  const unknownBody = '{"unrecognised":true}';

  it('returns no signals for an unrecognised payload instead of throwing', () => {
    expect(() => provider.parseDelivery(unknownBody, signed(unknownBody), {})).not.toThrow();
    expect(provider.parseDelivery(unknownBody, signed(unknownBody), {})).toEqual([]);
  });

  it('returns no signals for a body that is not JSON instead of throwing', () => {
    expect(() => provider.parseDelivery('not json', signed('not json'), {})).not.toThrow();
    expect(provider.parseDelivery('not json', signed('not json'), {})).toEqual([]);
  });

  it('reports a tampered body as bad_signature', () => {
    expect(provider.verifyDelivery('{"tampered":true}', signed(unknownBody), SECRET)).toEqual({
      kind: 'bad_signature',
    });
  });

  it('reports a delivery with no signature header as unsigned', () => {
    expect(provider.verifyDelivery(unknownBody, new Headers(), SECRET)).toEqual({
      kind: 'unsigned',
    });
  });

  it('parses deterministically', () => {
    const headers = signed(unknownBody);
    const first = provider.parseDelivery(unknownBody, headers, {});
    const second = provider.parseDelivery(unknownBody, headers, {});
    expect(first).toEqual(second);
  });

  it('declares a config schema that rejects a non-object', () => {
    expect(provider.configSchema.safeParse('nonsense').success).toBe(false);
  });
});
