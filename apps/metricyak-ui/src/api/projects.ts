import { apiFetch } from '@/lib/api';

export type Project = {
  id: string;
  name: string;
  organizationId: string;
  createdAt: string;
  updatedAt: string;
};

export function listProjects(organizationId: string): Promise<Project[]> {
  return apiFetch<Project[]>(`/v1/organizations/${organizationId}/projects`);
}

export function createProject(organizationId: string, name: string): Promise<Project> {
  return apiFetch<Project>(`/v1/organizations/${organizationId}/projects`, {
    method: 'POST',
    body: JSON.stringify({ name }),
  });
}
