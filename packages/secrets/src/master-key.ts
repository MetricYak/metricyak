import { randomBytes } from 'node:crypto';
import { inspect } from 'node:util';

export const MASTER_KEY_BYTES = 32;

const REDACTED = '[redacted]';

export class MasterKey {
  private constructor(private readonly keyBytes: Buffer) {}

  static of(bytes: Buffer): MasterKey {
    if (bytes.byteLength !== MASTER_KEY_BYTES) {
      throw new RangeError(
        `A master key must be ${MASTER_KEY_BYTES} bytes, got ${bytes.byteLength}.`,
      );
    }
    return new MasterKey(bytes);
  }

  expose(): Buffer {
    return this.keyBytes;
  }

  toString(): string {
    return REDACTED;
  }

  toJSON(): string {
    return REDACTED;
  }

  [inspect.custom](): string {
    return REDACTED;
  }
}

export type MasterKeyResult =
  | { kind: 'ok'; key: MasterKey }
  | { kind: 'not_base64' }
  | { kind: 'wrong_length'; byteLength: number };

function isCanonicalBase64(value: string, decoded: Buffer): boolean {
  return decoded.toString('base64') === value;
}

export function parseMasterKey(base64: string): MasterKeyResult {
  const trimmed = base64.trim();
  const decoded = Buffer.from(trimmed, 'base64');
  if (!isCanonicalBase64(trimmed, decoded)) return { kind: 'not_base64' };
  if (decoded.byteLength !== MASTER_KEY_BYTES) {
    return { kind: 'wrong_length', byteLength: decoded.byteLength };
  }
  return { kind: 'ok', key: MasterKey.of(decoded) };
}

export function generateMasterKey(): string {
  return randomBytes(MASTER_KEY_BYTES).toString('base64');
}
