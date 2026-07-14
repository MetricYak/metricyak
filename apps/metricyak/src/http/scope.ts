import type { ProjectRecord, ProjectsRepository } from '@metricyak/storage';
import { NotFoundError } from './errors.js';

export function orNotFound<T>(value: T | null | undefined, message: string): T {
  if (value == null) throw new NotFoundError(message);
  return value;
}

export async function requireProject(
  projects: Pick<ProjectsRepository, 'get'>,
  projectId: string,
): Promise<ProjectRecord> {
  return orNotFound(await projects.get(projectId), 'The project could not be found.');
}
