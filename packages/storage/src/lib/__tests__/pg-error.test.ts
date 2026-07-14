import { describe, expect, it } from 'vitest';
import { PG_CODES, pgErrorCode } from '../pg-error.js';

describe('pgErrorCode', () => {
  it('reads a pg code set directly on the error', () => {
    const error = Object.assign(new Error('duplicate key value'), { code: '23505' });
    expect(pgErrorCode(error)).toBe('23505');
  });

  it('walks the cause chain to a wrapped pg error', () => {
    const pgError = Object.assign(new Error('relation "organizations" does not exist'), {
      code: '42P01',
    });
    const wrapped = Object.assign(new Error('Failed query'), { cause: pgError });
    expect(pgErrorCode(wrapped)).toBe('42P01');
  });

  it('skips a wrapper code that is not a SQLSTATE and reaches the pg cause', () => {
    const pgError = Object.assign(new Error('duplicate key'), { code: '23505' });
    const wrapped = Object.assign(new Error('driver failure'), {
      code: 'ERR_WRAPPED',
      cause: pgError,
    });
    expect(pgErrorCode(wrapped)).toBe('23505');
  });

  it('returns null when a code is not a SQLSTATE', () => {
    const error = Object.assign(new Error('socket closed'), { code: 'ECONNREFUSED' });
    expect(pgErrorCode(error)).toBeNull();
  });

  it('returns null when no error in the chain carries a code', () => {
    const wrapped = new Error('connection refused', { cause: new Error('socket closed') });
    expect(pgErrorCode(wrapped)).toBeNull();
  });

  it('returns null for non-object input', () => {
    expect(pgErrorCode('boom')).toBeNull();
    expect(pgErrorCode(null)).toBeNull();
    expect(pgErrorCode(undefined)).toBeNull();
  });

  it('stops walking a pathologically deep cause chain and returns null', () => {
    let deepest: unknown = Object.assign(new Error('leaf'), { code: '23505' });
    for (let i = 0; i < 15; i++) {
      deepest = new Error(`wrap ${i}`, { cause: deepest });
    }
    expect(pgErrorCode(deepest)).toBeNull();
  });

  it('exposes the codes it classifies', () => {
    expect(PG_CODES.uniqueViolation).toBe('23505');
    expect(PG_CODES.undefinedTable).toBe('42P01');
  });
});
