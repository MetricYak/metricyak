import type { ProjectKeyState, ProjectKeysRepository } from '@metricyak/storage';

export async function ensureKeyForProject(
  projectKeys: Pick<ProjectKeysRepository, 'getState' | 'hasAnyKey' | 'generate'>,
  projectId: string,
  now: Date,
): Promise<ProjectKeyState> {
  const state = await projectKeys.getState(projectId, now);
  if (state.active || state.grace) return state;
  if (await projectKeys.hasAnyKey(projectId)) return state;

  await projectKeys.generate(projectId);
  return projectKeys.getState(projectId, now);
}
