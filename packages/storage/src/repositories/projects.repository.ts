import { eq } from 'drizzle-orm';
import type { Database } from '../client.js';
import { projects } from '../schema/projects.js';

export type CreateProjectInput = {
  organizationId: string;
  name: string;
};

export type ProjectRecord = {
  id: string;
  organizationId: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
};

export class ProjectsRepository {
  constructor(private readonly db: Database) {}

  async get(id: string): Promise<ProjectRecord | null> {
    const [project] = await this.db.select().from(projects).where(eq(projects.id, id)).limit(1);

    return project ?? null;
  }

  async listByOrganization(organizationId: string): Promise<ProjectRecord[]> {
    return this.db.select().from(projects).where(eq(projects.organizationId, organizationId));
  }

  async create(input: CreateProjectInput): Promise<ProjectRecord> {
    const [project] = await this.db
      .insert(projects)
      .values({ organizationId: input.organizationId, name: input.name })
      .returning();

    if (!project) {
      throw new Error('Failed to insert project.');
    }

    return project;
  }
}
