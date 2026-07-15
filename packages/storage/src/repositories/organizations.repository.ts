import { eq } from 'drizzle-orm';
import type { Database } from '@/client.js';
import { PG_CODES, pgErrorCode } from '@/lib/pg-error.js';
import { slugify } from '@/lib/slug.js';
import { organizations } from '@/schema/organizations.js';

export type OrganizationRecord = {
  id: string;
  slug: string;
  name: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type CreateOrganizationInput = {
  name: string;
};

const MAX_SLUG_ATTEMPTS = 25;

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

  async list(): Promise<OrganizationRecord[]> {
    return this.db.select().from(organizations);
  }

  async create(input: CreateOrganizationInput): Promise<OrganizationRecord> {
    const base = slugify(input.name);

    for (let attempt = 1; attempt <= MAX_SLUG_ATTEMPTS; attempt++) {
      const suffix = attempt === 1 ? '' : `-${attempt}`;
      const slug = `${base.slice(0, 64 - suffix.length)}${suffix}`;
      try {
        const [org] = await this.db
          .insert(organizations)
          .values({ name: input.name, slug })
          .returning();
        if (!org) throw new Error('Failed to insert organization.');
        return org;
      } catch (error) {
        if (pgErrorCode(error) === PG_CODES.uniqueViolation) continue;
        throw error;
      }
    }

    throw new Error('Could not generate a unique slug for the organization.');
  }
}
