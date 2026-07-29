import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import type { MasterKey } from '@/master-key.js';
import { Secret } from '@/secret.js';

const ALGORITHM = 'aes-256-gcm';
const FORMAT_AES_256_GCM = 1;
const IV_BYTES = 12;
const AUTH_TAG_BYTES = 16;
const HEADER_BYTES = 1 + IV_BYTES + AUTH_TAG_BYTES;

export const MAX_PLAINTEXT_BYTES = 64 * 1024;

export type DecryptResult =
  | { kind: 'ok'; value: Secret }
  | { kind: 'unsupported_format'; format: number }
  | { kind: 'malformed' }
  | { kind: 'undecryptable' };

export interface SecretCipher {
  encrypt(plaintext: Secret, aad: string): Buffer;
  decrypt(envelope: Buffer, aad: string): DecryptResult;
}

export function createSecretCipher(key: MasterKey): SecretCipher {
  return {
    encrypt(plaintext, aad) {
      const plaintextBytes = Buffer.from(plaintext.expose(), 'utf8');
      if (plaintextBytes.byteLength > MAX_PLAINTEXT_BYTES) {
        throw new RangeError(
          `A secret may be at most ${MAX_PLAINTEXT_BYTES} bytes, got ${plaintextBytes.byteLength}.`,
        );
      }

      const iv = randomBytes(IV_BYTES);
      const cipher = createCipheriv(ALGORITHM, key.expose(), iv);
      cipher.setAAD(Buffer.from(aad, 'utf8'));
      const ciphertext = Buffer.concat([cipher.update(plaintextBytes), cipher.final()]);

      return Buffer.concat([Buffer.of(FORMAT_AES_256_GCM), iv, cipher.getAuthTag(), ciphertext]);
    },

    decrypt(envelope, aad) {
      if (envelope.byteLength < HEADER_BYTES) return { kind: 'malformed' };

      const format = envelope.readUInt8(0);
      if (format !== FORMAT_AES_256_GCM) return { kind: 'unsupported_format', format };

      const iv = envelope.subarray(1, 1 + IV_BYTES);
      const authTag = envelope.subarray(1 + IV_BYTES, HEADER_BYTES);
      const ciphertext = envelope.subarray(HEADER_BYTES);

      try {
        const decipher = createDecipheriv(ALGORITHM, key.expose(), iv);
        decipher.setAAD(Buffer.from(aad, 'utf8'));
        decipher.setAuthTag(authTag);
        const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
        return { kind: 'ok', value: Secret.of(plaintext.toString('utf8')) };
      } catch {
        return { kind: 'undecryptable' };
      }
    },
  };
}
