import type { ClickHouseClient } from '@metricyak/clickhouse';
import {
  InMemoryEventsProducer,
  InMemoryMonitorDirtyBuffer,
  InMemoryMonitorEvalProducer,
  InMemoryMonitorSignalsProducer,
} from '@metricyak/queue';
import { createSecretCipher, MasterKey } from '@metricyak/secrets';
import type { Database } from '@metricyak/storage';
import { describe, expect, it } from 'vitest';
import { createContainer } from '@/container/container.js';

function newContainer() {
  return createContainer(
    {} as Database,
    new InMemoryEventsProducer(),
    new InMemoryMonitorSignalsProducer(),
    new InMemoryMonitorEvalProducer(),
    {} as ClickHouseClient,
    new InMemoryMonitorDirtyBuffer(),
    createSecretCipher(MasterKey.of(Buffer.alloc(32, 7))),
  );
}

describe('the secrets capability a route handler receives', () => {
  it('can write, replace, delete and list', () => {
    const { secrets } = newContainer().repos;

    expect(typeof secrets.create).toBe('function');
    expect(typeof secrets.replace).toBe('function');
    expect(typeof secrets.delete).toBe('function');
    expect(typeof secrets.listByProject).toBe('function');
  });

  it('cannot decrypt', () => {
    const { secrets } = newContainer().repos;

    expect('reveal' in secrets).toBe(false);
    expect(Object.keys(secrets).sort()).toEqual(['create', 'delete', 'listByProject', 'replace']);
  });

  it('cannot reach decryption by walking the prototype chain', () => {
    const { secrets } = newContainer().repos;
    const reachable = new Set<string>();
    for (let node = secrets; node; node = Object.getPrototypeOf(node)) {
      for (const key of Object.getOwnPropertyNames(node)) reachable.add(key);
    }

    expect(reachable.has('reveal')).toBe(false);
  });

  it('does not carry the cipher or the master key', () => {
    const container = newContainer();

    expect(Object.keys(container)).not.toContain('secretCipher');
    expect(Object.keys(container)).not.toContain('secretsMasterKey');
    expect(Object.keys(container.repos.secrets)).not.toContain('cipher');
  });
});
