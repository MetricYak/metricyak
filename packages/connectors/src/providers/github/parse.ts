import { z } from 'zod';
import type { ParsedSignal } from '@/contract/signal-provider.js';
import { githubConfigSchema } from '@/providers/github/config.js';

const deploymentStatusPayload = z.object({
  deployment_status: z.object({
    state: z.string(),
    created_at: z.iso.datetime({ offset: true }),
    target_url: z.string().nullish(),
  }),
  deployment: z.object({
    id: z.number(),
    sha: z.string(),
    ref: z.string(),
    environment: z.string(),
    created_at: z.iso.datetime({ offset: true }),
    creator: z.object({ login: z.string() }).nullish(),
  }),
  repository: z.object({ full_name: z.string() }),
});

const TERMINAL_STATUSES = new Map([
  ['success', 'succeeded'],
  ['failure', 'failed'],
  ['error', 'failed'],
]);

const PENDING_STATES = new Set(['pending', 'queued', 'in_progress']);

function toStatus(state: string): string | null {
  return TERMINAL_STATUSES.get(state) ?? (PENDING_STATES.has(state) ? 'pending' : null);
}

function safeJsonParse(body: string): unknown {
  try {
    return JSON.parse(body);
  } catch {
    return null;
  }
}

export function parseGithubDelivery(
  body: string,
  headers: Headers,
  config: Readonly<Record<string, unknown>>,
): readonly ParsedSignal[] {
  if (headers.get('x-github-event') !== 'deployment_status') return [];

  const parsedConfig = githubConfigSchema.safeParse(config);
  if (!parsedConfig.success) return [];

  const parsedBody = deploymentStatusPayload.safeParse(safeJsonParse(body));
  if (!parsedBody.success) return [];

  const { deployment, deployment_status: deploymentStatus } = parsedBody.data;

  const tracked = parsedConfig.data.environments;
  if (tracked.length > 0 && !tracked.includes(deployment.environment)) return [];

  const status = toStatus(deploymentStatus.state);
  if (status === null) return [];

  const isTerminal = TERMINAL_STATUSES.has(deploymentStatus.state);

  return [
    {
      kind: 'deployment',
      externalId: `deployment:${deployment.id}`,
      occurredAt: new Date(deployment.created_at),
      endedAt: isTerminal ? new Date(deploymentStatus.created_at) : null,
      title: `${deployment.ref} → ${deployment.environment}`,
      status,
      attributes: {
        sha: deployment.sha,
        ref: deployment.ref,
        actor: deployment.creator?.login ?? null,
        environment: deployment.environment,
        repo: parsedBody.data.repository.full_name,
        url: deploymentStatus.target_url ?? null,
      },
    },
  ];
}
