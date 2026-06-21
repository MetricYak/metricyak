import { eq } from 'drizzle-orm';
import type { Database } from '../client.js';
import { projects } from '../schema/projects.js';

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
}
