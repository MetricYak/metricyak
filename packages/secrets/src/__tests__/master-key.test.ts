import { randomBytes } from 'node:crypto';
import { inspect } from 'node:util';
import { describe, expect, it } from 'vitest';
import { generateMasterKey, MASTER_KEY_BYTES, MasterKey, parseMasterKey } from '@/master-key.js';

describe('parseMasterKey', () => {
  it('accepts a freshly generated key', () => {
    const result = parseMasterKey(generateMasterKey());

    expect(result.kind).toBe('ok');
    if (result.kind !== 'ok') return;
    expect(result.key.expose().byteLength).toBe(MASTER_KEY_BYTES);
  });

  it('accepts a key with surrounding whitespace', () => {
    expect(parseMasterKey(`  ${generateMasterKey()}\n`).kind).toBe('ok');
  });

  it('rejects a value that is not base64', () => {
    expect(parseMasterKey('not base64!!').kind).toBe('not_base64');
  });

  it('rejects an empty value', () => {
    expect(parseMasterKey('').kind).toBe('wrong_length');
  });

  it('reports the decoded length for a short key', () => {
    const result = parseMasterKey(randomBytes(31).toString('base64'));

    expect(result).toEqual({ kind: 'wrong_length', byteLength: 31 });
  });

  it('reports the decoded length for a long key', () => {
    const result = parseMasterKey(randomBytes(33).toString('base64'));

    expect(result).toEqual({ kind: 'wrong_length', byteLength: 33 });
  });
});

describe('MasterKey.of', () => {
  it('rejects a buffer that is not the required length', () => {
    expect(() => MasterKey.of(randomBytes(16))).toThrow(RangeError);
  });

  it('returns the same bytes from expose', () => {
    const bytes = randomBytes(MASTER_KEY_BYTES);

    expect(MasterKey.of(bytes).expose().equals(bytes)).toBe(true);
  });
});

describe('MasterKey redaction', () => {
  const bytes = randomBytes(MASTER_KEY_BYTES);
  const key = MasterKey.of(bytes);

  it('redacts under String()', () => {
    expect(String(key)).toBe('[redacted]');
  });

  it('redacts under JSON.stringify when nested in a config object', () => {
    const serialised = JSON.stringify({ secretsMasterKey: key, port: 3000 });

    expect(serialised).toBe('{"secretsMasterKey":"[redacted]","port":3000}');
    expect(serialised).not.toContain(bytes.join(','));
  });

  it('redacts under util.inspect when nested in a config object', () => {
    const output = inspect({ secretsMasterKey: key }, { depth: 10 });

    expect(output).not.toContain(bytes.join(','));
    expect(output).toContain('[redacted]');
  });
});

describe('generateMasterKey', () => {
  it('produces 32 bytes of base64', () => {
    expect(Buffer.from(generateMasterKey(), 'base64').byteLength).toBe(MASTER_KEY_BYTES);
  });

  it('produces a different key every time', () => {
    const keys = Array.from({ length: 50 }, () => generateMasterKey());

    expect(new Set(keys).size).toBe(50);
  });
});
