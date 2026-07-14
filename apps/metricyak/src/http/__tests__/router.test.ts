import { describe, expect, it } from 'vitest';
import { createRouter } from '../router.js';

describe('createRouter onError', () => {
  it('maps an unhandled unique-violation pg error to a 409', async () => {
    const router = createRouter();
    router.get('/boom', () => {
      throw Object.assign(new Error('duplicate key value violates unique constraint'), {
        code: '23505',
      });
    });

    const res = await router.request('/boom');
    expect(res.status).toBe(409);
    const body = (await res.json()) as { error_type: string }[];
    expect(body[0]?.error_type).toBe('conflict_error');
  });

  it('maps a unique violation wrapped in a cause chain to a 409', async () => {
    const router = createRouter();
    router.get('/boom', () => {
      const pgError = Object.assign(new Error('duplicate key'), { code: '23505' });
      throw Object.assign(new Error('Failed query'), { cause: pgError });
    });

    const res = await router.request('/boom');
    expect(res.status).toBe(409);
  });

  it('still maps an unknown error to a 500', async () => {
    const router = createRouter();
    router.get('/boom', () => {
      throw new Error('kaboom');
    });

    const res = await router.request('/boom');
    expect(res.status).toBe(500);
  });
});
