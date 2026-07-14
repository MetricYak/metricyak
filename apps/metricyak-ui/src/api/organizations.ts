import { apiFetch } from '@/lib/api';

export type Organization = {
  id: string;
  name: string;
  slug: string;
};

export function listOrganizations(): Promise<Organization[]> {
  return apiFetch<Organization[]>('/v1/organizations');
}

export function createOrganization(name: string): Promise<Organization> {
  return apiFetch<Organization>('/v1/organizations', {
    method: 'POST',
    body: JSON.stringify({ name }),
  });
}
