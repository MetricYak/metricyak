import { describe, expect, it } from 'vitest';
import { parseConfig } from '@/config.js';

const base = { RUN_WORKER_INLINE: 'true', CLICKHOUSE_URL: 'http://x:y@h:8123/d', KAFKA_BROKERS: 'a:9092' };

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

describe('kafka/clickhouse config', () => {
  const backendBase = {
    DATABASE_URL: 'postgres://u:p@localhost:5432/db',
    RUN_WORKER_INLINE: 'true',
    CLICKHOUSE_URL: 'http://x:y@h:8123/d',
  };

  it('parses comma-separated brokers', () => {
    const cfg = parseConfig({ ...backendBase, KAFKA_BROKERS: 'a:9092,b:9092' });
    expect(cfg.kafkaBrokers).toEqual(['a:9092', 'b:9092']);
  });

  it('requires CLICKHOUSE_URL', () => {
    expect(() =>
      parseConfig({ DATABASE_URL: backendBase.DATABASE_URL, RUN_WORKER_INLINE: 'true', KAFKA_BROKERS: 'a:9092' }),
    ).toThrow(/CLICKHOUSE_URL/);
  });

  it('rejects a non-URL CLICKHOUSE_URL', () => {
    expect(() =>
      parseConfig({ ...backendBase, CLICKHOUSE_URL: 'not-a-url', KAFKA_BROKERS: 'a:9092' }),
    ).toThrow();
  });

  it('rejects a missing KAFKA_BROKERS', () => {
    expect(() =>
      parseConfig({ DATABASE_URL: backendBase.DATABASE_URL, RUN_WORKER_INLINE: 'true', CLICKHOUSE_URL: backendBase.CLICKHOUSE_URL }),
    ).toThrow(/KAFKA_BROKERS/);
  });
});
