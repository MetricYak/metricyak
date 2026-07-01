import { eq } from 'drizzle-orm';
import type { Database } from '../client.js';
import { organizations } from '../schema/organizations.js';

export type OrganizationRecord = {
  id: string;
  slug: string;
  name: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export class OrganizationsRepository {
  constructor(private readonly db: Database) {}

  async get(id: string): Promise<OrganizationRecord | null> {
    const [org] = await this.db
      .select()
      .from(organizations)
      .where(eq(organizations.id, id))
      .limit(1);

    return org ?? null;
  }
}
