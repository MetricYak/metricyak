import { describe, expect, it } from 'vitest';
import { projectPath, sectionRootOf } from '@/lib/project-path';

describe('projectPath', () => {
  it('prefixes a leading-slash suffix with the project segment', () => {
    expect(projectPath('abc', '/metrics/explore')).toBe('/projects/abc/metrics/explore');
  });

  it('accepts a suffix without a leading slash', () => {
    expect(projectPath('abc', 'metrics/explore')).toBe('/projects/abc/metrics/explore');
  });

  it('returns the project root for an empty suffix', () => {
    expect(projectPath('abc', '')).toBe('/projects/abc');
  });

  it('preserves query strings', () => {
    expect(projectPath('abc', '/metrics/explore?m=1')).toBe('/projects/abc/metrics/explore?m=1');
  });
});

describe('sectionRootOf', () => {
  it('keeps the first segment below the project', () => {
    expect(sectionRootOf('/projects/a/metrics/explore')).toBe('/metrics');
  });

  it('drops everything past the section root', () => {
    expect(sectionRootOf('/projects/a/settings/project/key')).toBe('/settings');
  });

  it('falls back to the explorer when the path names no section', () => {
    expect(sectionRootOf('/projects/a')).toBe('/metrics/explore');
  });
});
