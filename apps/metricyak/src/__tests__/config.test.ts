import { describe, expect, it } from 'vitest';
import { parseConfig } from '../config.js';

const base = { RUN_WORKER_INLINE: 'true' };

describe('parseConfig DATABASE_URL', () => {
  it('accepts a credentialed postgres URL', () => {
    const cfg = parseConfig({
      ...base,
      DATABASE_URL: 'postgres://metricyak:metricyak@localhost:5432/metricyak',
    });
    expect(cfg.databaseUrl).toContain('postgres://');
  });

  it('rejects a non-postgres scheme', () => {
    expect(() => parseConfig({ ...base, DATABASE_URL: 'http://localhost:5432' })).toThrow(
      /postgres/i,
    );
  });

  it('rejects a URL without a password', () => {
    expect(() =>
      parseConfig({ ...base, DATABASE_URL: 'postgres://metricyak@localhost:5432/metricyak' }),
    ).toThrow(/password/i);
  });
});
