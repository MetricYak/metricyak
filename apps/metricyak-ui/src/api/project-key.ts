import { apiFetch } from '@/lib/api';

export type ActiveProjectKey = {
  key: string;
  createdAt: string;
  lastUsedAt: string | null;
};

export type GraceProjectKey = {
  key: string;
  expiresAt: string;
};

export type ProjectKeyState = {
  active: ActiveProjectKey | null;
  grace: GraceProjectKey | null;
};

export function getProjectKey(projectId: string): Promise<ProjectKeyState> {
  return apiFetch<ProjectKeyState>(`/v1/projects/${projectId}/key`);
}

export function generateProjectKey(projectId: string): Promise<ProjectKeyState> {
  return apiFetch<ProjectKeyState>(`/v1/projects/${projectId}/key`, { method: 'POST' });
}

export function rollProjectKey(projectId: string): Promise<ProjectKeyState> {
  return apiFetch<ProjectKeyState>(`/v1/projects/${projectId}/key/roll`, { method: 'POST' });
}

export function revokeProjectKey(projectId: string): Promise<ProjectKeyState> {
  return apiFetch<ProjectKeyState>(`/v1/projects/${projectId}/key`, { method: 'DELETE' });
}

export function revokeGraceKey(projectId: string): Promise<ProjectKeyState> {
  return apiFetch<ProjectKeyState>(`/v1/projects/${projectId}/key/grace`, { method: 'DELETE' });
}
