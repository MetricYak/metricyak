import { apiFetch } from '@/lib/api';

export type ProjectKey = {
  id: string;
  projectId: string;
  name: string;
  createdAt: string;
  revokedAt: string | null;
};

export type CreatedProjectKey = {
  id: string;
  projectId: string;
  name: string;
  key: string;
  createdAt: string;
};

export function listProjectKeys(projectId: string): Promise<ProjectKey[]> {
  return apiFetch<ProjectKey[]>(`/v1/projects/${projectId}/keys`);
}

export function createProjectKey(projectId: string, name: string): Promise<CreatedProjectKey> {
  return apiFetch<CreatedProjectKey>(`/v1/projects/${projectId}/keys`, {
    method: 'POST',
    body: JSON.stringify({ name }),
  });
}

export function revokeProjectKey(projectId: string, keyId: string): Promise<{ revoked: boolean }> {
  return apiFetch<{ revoked: boolean }>(`/v1/projects/${projectId}/keys/${keyId}`, {
    method: 'DELETE',
  });
}
