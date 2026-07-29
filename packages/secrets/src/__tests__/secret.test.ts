import { inspect } from 'node:util';
import { describe, expect, it, vi } from 'vitest';
import { Secret } from '@/secret.js';

const PLAINTEXT = 'correct-horse-battery-staple';
const REDACTED = '[redacted]';

describe('Secret redaction', () => {
  it('returns the plaintext only from expose', () => {
    expect(Secret.of(PLAINTEXT).expose()).toBe(PLAINTEXT);
  });

  it('redacts under String()', () => {
    expect(String(Secret.of(PLAINTEXT))).toBe(REDACTED);
  });

  it('redacts under template interpolation', () => {
    expect(`${Secret.of(PLAINTEXT)}`).toBe(REDACTED);
  });

  it('redacts under string concatenation', () => {
    expect(`${`key=${Secret.of(PLAINTEXT)}`}`).toBe(`key=${REDACTED}`);
  });

  it('redacts under JSON.stringify when nested in an object', () => {
    const serialised = JSON.stringify({ credential: Secret.of(PLAINTEXT) });

    expect(serialised).toBe(`{"credential":"${REDACTED}"}`);
    expect(serialised).not.toContain(PLAINTEXT);
  });

  it('redacts under util.inspect', () => {
    expect(inspect(Secret.of(PLAINTEXT))).toBe(REDACTED);
  });

  it('redacts under util.inspect when deeply nested', () => {
    const output = inspect({ source: { credential: Secret.of(PLAINTEXT) } }, { depth: 10 });

    expect(output).not.toContain(PLAINTEXT);
    expect(output).toContain(REDACTED);
  });

  it('redacts inside an Error message built by interpolation', () => {
    const error = new Error(`could not connect with ${Secret.of(PLAINTEXT)}`);

    expect(error.message).not.toContain(PLAINTEXT);
  });
});

describe('Secret leak resistance in logs', () => {
  it('never writes the plaintext to console.log', () => {
    const written: string[] = [];
    const spy = vi.spyOn(console, 'log').mockImplementation((...args: unknown[]) => {
      written.push(args.map((arg) => inspect(arg)).join(' '));
    });

    const secret = Secret.of(PLAINTEXT);
    console.log(secret);
    console.log({ credential: secret });
    console.log({ source: { nested: { credential: secret } } });
    console.log(JSON.stringify({ credential: secret }));
    console.log(new Error(`failed with ${secret}`).message);

    spy.mockRestore();

    expect(written).not.toHaveLength(0);
    for (const line of written) {
      expect(line).not.toContain(PLAINTEXT);
    }
  });
});
