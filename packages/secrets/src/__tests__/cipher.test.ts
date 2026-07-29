import { describe, expect, it } from 'vitest';
import { createSecretCipher, MAX_PLAINTEXT_BYTES } from '@/cipher.js';
import { generateMasterKey, parseMasterKey } from '@/master-key.js';
import { Secret } from '@/secret.js';

function newCipher() {
  const parsed = parseMasterKey(generateMasterKey());
  if (parsed.kind !== 'ok') throw new Error(`generateMasterKey produced ${parsed.kind}`);
  return createSecretCipher(parsed.key);
}

const AAD = 'project-1:secret-1';

describe('SecretCipher round-trip', () => {
  it('returns the exact plaintext it was given', () => {
    const cipher = newCipher();
    const envelope = cipher.encrypt(Secret.of('hunter2'), AAD);

    const result = cipher.decrypt(envelope, AAD);

    expect(result.kind).toBe('ok');
    if (result.kind !== 'ok') return;
    expect(result.value.expose()).toBe('hunter2');
  });

  it('round-trips an empty secret', () => {
    const cipher = newCipher();
    const result = cipher.decrypt(cipher.encrypt(Secret.of(''), AAD), AAD);

    expect(result.kind).toBe('ok');
    if (result.kind !== 'ok') return;
    expect(result.value.expose()).toBe('');
  });

  it('round-trips a multi-byte JSON credential', () => {
    const cipher = newCipher();
    const credential = JSON.stringify({ password: 'pä€ß', host: 'db.example.com' });

    const result = cipher.decrypt(cipher.encrypt(Secret.of(credential), AAD), AAD);

    expect(result.kind).toBe('ok');
    if (result.kind !== 'ok') return;
    expect(result.value.expose()).toBe(credential);
  });

  it('never contains the plaintext in the envelope', () => {
    const cipher = newCipher();
    const envelope = cipher.encrypt(Secret.of('hunter2'), AAD);

    expect(envelope.toString('utf8')).not.toContain('hunter2');
    expect(envelope.toString('latin1')).not.toContain('hunter2');
  });

  it('produces a different envelope every time for the same plaintext', () => {
    const cipher = newCipher();
    const envelopes = Array.from({ length: 50 }, () =>
      cipher.encrypt(Secret.of('same'), AAD).toString('base64'),
    );

    expect(new Set(envelopes).size).toBe(50);
  });

  it('rejects a plaintext larger than the cap', () => {
    const cipher = newCipher();
    const oversized = Secret.of('x'.repeat(MAX_PLAINTEXT_BYTES + 1));

    expect(() => cipher.encrypt(oversized, AAD)).toThrow(RangeError);
  });

  it('accepts a plaintext exactly at the cap', () => {
    const cipher = newCipher();
    const atCap = Secret.of('x'.repeat(MAX_PLAINTEXT_BYTES));

    expect(() => cipher.encrypt(atCap, AAD)).not.toThrow();
  });
});

describe('SecretCipher rejection', () => {
  it('reports undecryptable for a different master key', () => {
    const envelope = newCipher().encrypt(Secret.of('hunter2'), AAD);

    expect(newCipher().decrypt(envelope, AAD).kind).toBe('undecryptable');
  });

  it('reports undecryptable when the AAD does not match', () => {
    const cipher = newCipher();
    const envelope = cipher.encrypt(Secret.of('hunter2'), 'project-1:secret-1');

    expect(cipher.decrypt(envelope, 'project-2:secret-1').kind).toBe('undecryptable');
  });

  it('reports undecryptable when a ciphertext byte is flipped', () => {
    const cipher = newCipher();
    const envelope = cipher.encrypt(Secret.of('hunter2'), AAD);
    const tampered = Buffer.from(envelope);
    const lastIndex = tampered.byteLength - 1;
    tampered.writeUInt8(tampered.readUInt8(lastIndex) ^ 0xff, lastIndex);

    expect(cipher.decrypt(tampered, AAD).kind).toBe('undecryptable');
  });

  it('reports undecryptable when an auth tag byte is flipped', () => {
    const cipher = newCipher();
    const envelope = cipher.encrypt(Secret.of('hunter2'), AAD);
    const tampered = Buffer.from(envelope);
    tampered.writeUInt8(tampered.readUInt8(13) ^ 0xff, 13);

    expect(cipher.decrypt(tampered, AAD).kind).toBe('undecryptable');
  });

  it('reports undecryptable when the iv is changed', () => {
    const cipher = newCipher();
    const envelope = cipher.encrypt(Secret.of('hunter2'), AAD);
    const tampered = Buffer.from(envelope);
    tampered.writeUInt8(tampered.readUInt8(1) ^ 0xff, 1);

    expect(cipher.decrypt(tampered, AAD).kind).toBe('undecryptable');
  });

  it('reports malformed for a truncated envelope', () => {
    const cipher = newCipher();
    const envelope = cipher.encrypt(Secret.of('hunter2'), AAD);

    expect(cipher.decrypt(envelope.subarray(0, 28), AAD).kind).toBe('malformed');
  });

  it('reports malformed for an empty envelope', () => {
    expect(newCipher().decrypt(Buffer.alloc(0), AAD).kind).toBe('malformed');
  });

  it('reports the format number for an unknown format byte', () => {
    const cipher = newCipher();
    const envelope = Buffer.from(cipher.encrypt(Secret.of('hunter2'), AAD));
    envelope.writeUInt8(99, 0);

    const result = cipher.decrypt(envelope, AAD);

    expect(result).toEqual({ kind: 'unsupported_format', format: 99 });
  });
});
