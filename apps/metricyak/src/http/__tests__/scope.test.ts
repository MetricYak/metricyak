import type { ProjectRecord } from '@metricyak/storage';
import { describe, expect, it } from 'vitest';
import { NotFoundError } from '../errors.js';
import { orNotFound, requireProject } from '../scope.js';

const project: ProjectRecord = {
  id: 'p1',
  organizationId: 'o1',
  name: 'Proj',
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('orNotFound', () => {
  it('returns the value when it is present', () => {
    expect(orNotFound(project, 'missing')).toBe(project);
  });

  it('returns falsy-but-present values unchanged', () => {
    expect(orNotFound(0, 'missing')).toBe(0);
    expect(orNotFound('', 'missing')).toBe('');
  });

  it('throws NotFoundError with the message when null or undefined', () => {
    expect(() => orNotFound(null, 'gone')).toThrow(NotFoundError);
    expect(() => orNotFound(undefined, 'gone')).toThrow('gone');
  });
});

describe('requireProject', () => {
  it('returns the project when it exists', async () => {
    const projects = { get: async () => project };
    await expect(requireProject(projects, 'p1')).resolves.toBe(project);
  });

  it('throws NotFoundError when the project is missing', async () => {
    const projects = { get: async () => null };
    await expect(requireProject(projects, 'p1')).rejects.toThrow(NotFoundError);
  });
});
