export type Organization = {
  id: string;
  name: string;
  slug: string;
};

export async function listOrganizations(): Promise<Organization[]> {
  return [{ id: '00000000-0000-4000-8000-0000000000a1', name: 'MetricYak (Dev)', slug: 'default' }];
}
