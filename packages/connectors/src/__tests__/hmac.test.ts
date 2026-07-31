import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { verifyHmacSha256 } from '@/hmac.js';

const SECRET = 'whsec_test';
const BODY = '{"hello":"world"}';

function sign(body: string, secret: string): string {
  return `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`;
}

describe('verifyHmacSha256', () => {
  it('accepts a correctly signed body', () => {
    expect(verifyHmacSha256(BODY, sign(BODY, SECRET), SECRET, 'sha256=')).toEqual({ kind: 'ok' });
  });

  it('rejects a tampered body', () => {
    expect(verifyHmacSha256('{"hello":"mars"}', sign(BODY, SECRET), SECRET, 'sha256=')).toEqual({
      kind: 'bad_signature',
    });
  });

  it('rejects a signature made with a different secret', () => {
    expect(verifyHmacSha256(BODY, sign(BODY, 'other'), SECRET, 'sha256=')).toEqual({
      kind: 'bad_signature',
    });
  });

  it('reports a missing signature header as unsigned', () => {
    expect(verifyHmacSha256(BODY, null, SECRET, 'sha256=')).toEqual({ kind: 'unsigned' });
  });

  it('reports a signature with the wrong prefix as unsigned', () => {
    expect(verifyHmacSha256(BODY, 'sha1=abc', SECRET, 'sha256=')).toEqual({ kind: 'unsigned' });
  });

  it('rejects a signature of the wrong length without throwing', () => {
    expect(verifyHmacSha256(BODY, 'sha256=abcd', SECRET, 'sha256=')).toEqual({
      kind: 'bad_signature',
    });
  });
});
