import { createHmac, timingSafeEqual } from 'node:crypto';
import type { DeliveryVerification } from '@/contract/signal-provider.js';

export function verifyHmacSha256(
  body: string,
  signatureHeader: string | null,
  secret: string,
  prefix: string,
): DeliveryVerification {
  if (signatureHeader === null || !signatureHeader.startsWith(prefix)) {
    return { kind: 'unsigned' };
  }

  const provided = Buffer.from(signatureHeader.slice(prefix.length), 'hex');
  const expected = createHmac('sha256', secret).update(body).digest();

  if (provided.byteLength !== expected.byteLength) return { kind: 'bad_signature' };
  if (!timingSafeEqual(provided, expected)) return { kind: 'bad_signature' };

  return { kind: 'ok' };
}
