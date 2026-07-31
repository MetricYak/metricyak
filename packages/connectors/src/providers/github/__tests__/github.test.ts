import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { isAllowedSignalStatus } from '@/contract/signal-provider.js';
import { githubProvider } from '@/providers/github/index.js';
import failure from './fixtures/deployment-status-failure.json' with { type: 'json' };
import pending from './fixtures/deployment-status-pending.json' with { type: 'json' };
import success from './fixtures/deployment-status-success.json' with { type: 'json' };
import ping from './fixtures/ping.json' with { type: 'json' };

const SECRET = 'whsec_test';
const CONFIG = { repo: 'acme/web', environments: [] };

function delivery(payload: unknown, event: string): { body: string; headers: Headers } {
  const body = JSON.stringify(payload);
  const signature = `sha256=${createHmac('sha256', SECRET).update(body).digest('hex')}`;
  return {
    body,
    headers: new Headers({ 'x-github-event': event, 'x-hub-signature-256': signature }),
  };
}

describe('githubProvider.verifyDelivery', () => {
  it('accepts a correctly signed delivery', () => {
    const { body, headers } = delivery(pending, 'deployment_status');
    expect(githubProvider.verifyDelivery(body, headers, SECRET)).toEqual({ kind: 'ok' });
  });

  it('rejects a tampered body', () => {
    const { headers } = delivery(pending, 'deployment_status');
    expect(githubProvider.verifyDelivery('{"tampered":true}', headers, SECRET)).toEqual({
      kind: 'bad_signature',
    });
  });

  it('reports a delivery with no signature as unsigned', () => {
    const { body } = delivery(pending, 'deployment_status');
    const headers = new Headers({ 'x-github-event': 'deployment_status' });
    expect(githubProvider.verifyDelivery(body, headers, SECRET)).toEqual({ kind: 'unsigned' });
  });
});

describe('githubProvider.parseDelivery', () => {
  it('maps a pending deployment status to a pending signal', () => {
    const { body, headers } = delivery(pending, 'deployment_status');
    const [signal] = githubProvider.parseDelivery(body, headers, CONFIG);

    expect(signal).toEqual({
      kind: 'deployment',
      externalId: 'deployment:456',
      occurredAt: new Date('2026-07-30T14:02:00Z'),
      observedAt: new Date('2026-07-30T14:02:00Z'),
      endedAt: null,
      title: 'v2.4.1 → production',
      status: 'pending',
      attributes: {
        sha: '9f8e7d6c5b4a39281706f5e4d3c2b1a098765432',
        ref: 'v2.4.1',
        actor: 'jdoe',
        environment: 'production',
        repo: 'acme/web',
        url: 'https://github.com/acme/web/deployments/456',
      },
    });
  });

  it('sets endedAt on a terminal status', () => {
    const { body, headers } = delivery(success, 'deployment_status');
    const [signal] = githubProvider.parseDelivery(body, headers, CONFIG);

    expect(signal?.status).toBe('succeeded');
    expect(signal?.endedAt).toEqual(new Date('2026-07-30T14:06:00Z'));
  });

  it('keeps externalId stable across a lifecycle so deliveries collapse to one signal', () => {
    const first = delivery(pending, 'deployment_status');
    const second = delivery(success, 'deployment_status');

    const [a] = githubProvider.parseDelivery(first.body, first.headers, CONFIG);
    const [b] = githubProvider.parseDelivery(second.body, second.headers, CONFIG);

    expect(a?.externalId).toBe(b?.externalId);
  });

  it('advances observedAt across a lifecycle so a stale delivery can be told apart', () => {
    const first = delivery(pending, 'deployment_status');
    const second = delivery(success, 'deployment_status');

    const [a] = githubProvider.parseDelivery(first.body, first.headers, CONFIG);
    const [b] = githubProvider.parseDelivery(second.body, second.headers, CONFIG);

    expect(a?.occurredAt).toEqual(b?.occurredAt);
    expect(a?.observedAt.getTime()).toBeLessThan(b?.observedAt.getTime() ?? 0);
  });

  it('maps a failed deployment status to a failed signal', () => {
    const { body, headers } = delivery(failure, 'deployment_status');
    const [signal] = githubProvider.parseDelivery(body, headers, CONFIG);

    expect(signal?.status).toBe('failed');
    expect(signal?.externalId).toBe('deployment:457');
  });

  it('only produces statuses the deployment kind declares', () => {
    for (const payload of [pending, success, failure]) {
      const { body, headers } = delivery(payload, 'deployment_status');
      for (const signal of githubProvider.parseDelivery(body, headers, CONFIG)) {
        expect(isAllowedSignalStatus(signal.kind, signal.status)).toBe(true);
      }
    }
  });

  it('ignores a ping delivery', () => {
    const { body, headers } = delivery(ping, 'ping');
    expect(githubProvider.parseDelivery(body, headers, CONFIG)).toEqual([]);
  });

  it('ignores environments the source does not track', () => {
    const { body, headers } = delivery(pending, 'deployment_status');
    const scoped = { repo: 'acme/web', environments: ['staging'] };
    expect(githubProvider.parseDelivery(body, headers, scoped)).toEqual([]);
  });

  it('ignores a delivery from a repository the source is not configured for', () => {
    const fromAnotherRepo = {
      ...pending,
      repository: { full_name: 'acme/billing', html_url: 'https://github.com/acme/billing' },
    };
    const { body, headers } = delivery(fromAnotherRepo, 'deployment_status');
    expect(githubProvider.parseDelivery(body, headers, CONFIG)).toEqual([]);
  });

  it('matches the configured repository regardless of case', () => {
    const { body, headers } = delivery(pending, 'deployment_status');
    const shouted = { repo: 'ACME/Web', environments: [] };
    expect(githubProvider.parseDelivery(body, headers, shouted)).toHaveLength(1);
  });

  it('ignores a payload it does not recognise instead of throwing', () => {
    const { headers } = delivery(pending, 'deployment_status');
    expect(githubProvider.parseDelivery('{"unexpected":true}', headers, CONFIG)).toEqual([]);
  });
});
