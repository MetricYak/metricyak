import { randomBytes } from 'node:crypto';

const SECRET_PREFIX = 'whsec_';
const SECRET_BYTES = 32;

export function generateWebhookSecret(): string {
  return `${SECRET_PREFIX}${randomBytes(SECRET_BYTES).toString('hex')}`;
}

export function webhookUrlFor(requestUrl: string, sourceId: string): string {
  return `${new URL(requestUrl).origin}/webhooks/signals/${sourceId}`;
}
