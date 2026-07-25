import { randomBytes } from 'node:crypto';

const PREFIX = 'myk_';
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
const KEY_LENGTH = 43;
const MAX_BYTE = Math.floor(256 / ALPHABET.length) * ALPHABET.length;

export function generatePublishableKey(): string {
  const chars: string[] = [];
  while (chars.length < KEY_LENGTH) {
    const bytes = randomBytes(KEY_LENGTH);
    for (const byte of bytes) {
      if (byte < MAX_BYTE) {
        chars.push(ALPHABET.charAt(byte % ALPHABET.length));
        if (chars.length === KEY_LENGTH) break;
      }
    }
  }
  return PREFIX + chars.join('');
}
