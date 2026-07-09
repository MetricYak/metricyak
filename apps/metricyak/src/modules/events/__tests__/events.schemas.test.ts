import { describe, expect, it } from 'vitest';
import { IngestEvent } from '../events.schemas.js';

describe('IngestEvent', () => {
  it('accepts an event name at the 255-character limit', () => {
    expect(IngestEvent.safeParse({ name: 'a'.repeat(255) }).success).toBe(true);
  });

  it('rejects an event name longer than 255 characters', () => {
    expect(IngestEvent.safeParse({ name: 'a'.repeat(256) }).success).toBe(false);
  });

  it('accepts properties within the size limit', () => {
    expect(IngestEvent.safeParse({ name: 'signup', properties: { plan: 'pro' } }).success).toBe(
      true,
    );
  });

  it('rejects properties that serialize beyond the size limit', () => {
    expect(
      IngestEvent.safeParse({ name: 'signup', properties: { blob: 'x'.repeat(20_000) } }).success,
    ).toBe(false);
  });
});
