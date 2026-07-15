import { and, eq, inArray, sql } from 'drizzle-orm';
import type { Database } from '@/client.js';
import {
  type MetricDefinition,
  metricDefinitions,
  metricDefinitionVersions,
} from '@/schema/metrics.js';

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

export type MetricSummary = {
  metricId: string;
  version: number;
  name: string;
  definition: MetricDefinition;
};

export class MetricsRepository {
  constructor(private readonly db: Database) {}

  async get(id: string, projectId: string): Promise<{ id: string } | null> {
    const [metric] = await this.db
      .select({ id: metricDefinitions.id })
      .from(metricDefinitions)
      .where(and(eq(metricDefinitions.id, id), eq(metricDefinitions.projectId, projectId)))
      .limit(1);

    return metric ?? null;
  }

  async getDefinition(id: string, projectId: string): Promise<MetricSummary | null> {
    const [row] = await this.db
      .select({
        metricId: metricDefinitions.id,
        version: metricDefinitionVersions.version,
        name: metricDefinitionVersions.name,
        definition: metricDefinitionVersions.definition,
      })
      .from(metricDefinitions)
      .innerJoin(
        metricDefinitionVersions,
        eq(metricDefinitions.currentVersionId, metricDefinitionVersions.id),
      )
      .where(and(eq(metricDefinitions.id, id), eq(metricDefinitions.projectId, projectId)))
      .limit(1);

    if (!row) return null;

    return {
      metricId: row.metricId,
      version: row.version,
      name: row.name,
      definition: row.definition,
    };
  }

  async listByIds(ids: readonly string[]): Promise<MetricSummary[]> {
    if (ids.length === 0) return [];

    const rows = await this.db
      .select({
        metricId: metricDefinitions.id,
        version: metricDefinitionVersions.version,
        name: metricDefinitionVersions.name,
        definition: metricDefinitionVersions.definition,
      })
      .from(metricDefinitions)
      .innerJoin(
        metricDefinitionVersions,
        eq(metricDefinitions.currentVersionId, metricDefinitionVersions.id),
      )
      .where(inArray(metricDefinitions.id, [...ids]));

    return rows.map((row) => ({
      metricId: row.metricId,
      version: row.version,
      name: row.name,
      definition: row.definition,
    }));
  }

  async matcherEpoch(projectId: string): Promise<string> {
    const [row] = await this.db
      .select({
        count: sql<number>`cast(count(*) as int)`,
        updatedAt: sql<string | null>`max(${metricDefinitions.updatedAt})`,
      })
      .from(metricDefinitions)
      .where(eq(metricDefinitions.projectId, projectId));

    const millis = row?.updatedAt ? new Date(row.updatedAt).getTime() : 0;
    return `${row?.count ?? 0}:${millis}`;
  }

  async listByProject(projectId: string): Promise<MetricSummary[]> {
    const rows = await this.db
      .select({
        metricId: metricDefinitions.id,
        version: metricDefinitionVersions.version,
        name: metricDefinitionVersions.name,
        definition: metricDefinitionVersions.definition,
      })
      .from(metricDefinitions)
      .innerJoin(
        metricDefinitionVersions,
        eq(metricDefinitions.currentVersionId, metricDefinitionVersions.id),
      )
      .where(eq(metricDefinitions.projectId, projectId));

    return rows.map((row) => ({
      metricId: row.metricId,
      version: row.version,
      name: row.name,
      definition: row.definition,
    }));
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
