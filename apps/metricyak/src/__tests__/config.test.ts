import { describe, expect, it } from 'vitest';
import { parseConfig } from '@/config.js';

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

describe('aggregates backend + kafka/clickhouse config', () => {
  const backendBase = {
    DATABASE_URL: 'postgres://u:p@localhost:5432/db',
    RUN_WORKER_INLINE: 'true',
  };

  it('defaults aggregatesBackend to postgres and parses brokers', () => {
    const cfg = parseConfig({ ...backendBase, KAFKA_BROKERS: 'a:9092,b:9092' });
    expect(cfg.aggregatesBackend).toBe('postgres');
    expect(cfg.kafkaBrokers).toEqual(['a:9092', 'b:9092']);
  });

  it('accepts clickhouse backend', () => {
    const cfg = parseConfig({
      ...backendBase,
      AGGREGATES_BACKEND: 'clickhouse',
      CLICKHOUSE_URL: 'http://x:y@h:8123/d',
    });
    expect(cfg.aggregatesBackend).toBe('clickhouse');
    expect(cfg.clickhouseUrl).toBe('http://x:y@h:8123/d');
  });

  it('rejects an unknown backend', () => {
    expect(() => parseConfig({ ...backendBase, AGGREGATES_BACKEND: 'mongo' })).toThrow();
  });
});
