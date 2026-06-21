import { eq } from 'drizzle-orm';
import type { Database } from '../client.js';
import {
  type MetricDefinition,
  metricDefinitions,
  metricDefinitionVersions,
} from '../schema/metrics.js';

export type CreateMetricInput = {
  projectId: string;
  name: string;
  description?: string | null;
  definition: MetricDefinition;
};

export type MetricRecord = {
  id: string;
  projectId: string;
  version: number;
  name: string;
  description: string | null;
  definition: MetricDefinition;
  createdAt: Date;
  updatedAt: Date;
};

export class MetricsRepository {
  constructor(private readonly db: Database) {}

  async create(input: CreateMetricInput): Promise<MetricRecord> {
    return this.db.transaction(async (tx) => {
      const [metric] = await tx
        .insert(metricDefinitions)
        .values({ projectId: input.projectId })
        .returning();

      if (!metric) {
        throw new Error('Failed to insert metric definition.');
      }

      const [version] = await tx
        .insert(metricDefinitionVersions)
        .values({
          metricDefinitionId: metric.id,
          version: 1,
          name: input.name,
          description: input.description ?? null,
          definition: input.definition,
        })
        .returning();
      if (!version) {
        throw new Error('Failed to insert metric definition version.');
      }

      await tx
        .update(metricDefinitions)
        .set({ currentVersionId: version.id })
        .where(eq(metricDefinitions.id, metric.id));

      return {
        id: metric.id,
        projectId: metric.projectId,
        version: version.version,
        name: version.name,
        description: version.description,
        definition: version.definition,
        createdAt: metric.createdAt,
        updatedAt: metric.updatedAt,
      };
    });
  }
}
