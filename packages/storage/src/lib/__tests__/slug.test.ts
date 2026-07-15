import { describe, expect, it } from 'vitest';
import { slugify } from '@/lib/slug.js';

describe('slugify', () => {
  it('lowercases and hyphenates words', () => {
    expect(slugify('Acme Rockets')).toBe('acme-rockets');
  });

  it('strips punctuation and collapses separators', () => {
    expect(slugify('  Foo & Bar!! ')).toBe('foo-bar');
  });

  it('falls back to "org" when no usable characters remain', () => {
    expect(slugify('!!!')).toBe('org');
    expect(slugify('')).toBe('org');
  });

  it('caps length at 64 characters', () => {
    expect(slugify('a'.repeat(100)).length).toBe(64);
  });
});
