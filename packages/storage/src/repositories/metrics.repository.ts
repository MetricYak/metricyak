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

  async get(id: string): Promise<{ id: string } | null> {
    const [metric] = await this.db
      .select({ id: metricDefinitions.id })
      .from(metricDefinitions)
      .where(eq(metricDefinitions.id, id))
      .limit(1);

    return metric ?? null;
  }

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

      const [updatedMetric] = await tx
        .update(metricDefinitions)
        .set({ currentVersionId: version.id, updatedAt: metric.updatedAt })
        .where(eq(metricDefinitions.id, metric.id))
        .returning();
      if (!updatedMetric) {
        throw new Error('Failed to update metric definition.');
      }

      return {
        id: updatedMetric.id,
        projectId: updatedMetric.projectId,
        version: version.version,
        name: version.name,
        description: version.description,
        definition: version.definition,
        createdAt: updatedMetric.createdAt,
        updatedAt: updatedMetric.updatedAt,
      };
    });
  }
}
