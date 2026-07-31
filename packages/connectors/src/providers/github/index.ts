import type { DeliveryVerification, SignalProvider } from '@/contract/signal-provider.js';
import { verifyHmacSha256 } from '@/hmac.js';
import { githubConfigSchema } from '@/providers/github/config.js';
import { parseGithubDelivery } from '@/providers/github/parse.js';

const SIGNATURE_HEADER = 'x-hub-signature-256';
const SIGNATURE_PREFIX = 'sha256=';

export const githubProvider: SignalProvider = {
  provider: 'github',
  configSchema: githubConfigSchema,

  verifyDelivery(body: string, headers: Headers, secret: string): DeliveryVerification {
    return verifyHmacSha256(body, headers.get(SIGNATURE_HEADER), secret, SIGNATURE_PREFIX);
  },

  parseDelivery: parseGithubDelivery,
};

export type { GithubConfig } from '@/providers/github/config.js';
export { githubConfigSchema } from '@/providers/github/config.js';
