import {
  type AnyPgColumn,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { projects } from './projects.js';

export const METRIC_AGGREGATIONS = ['count', 'sum', 'average'] as const;

export type MetricAggregation = (typeof METRIC_AGGREGATIONS)[number];

export type MetricEvent = {
  key: string;
  source: string;
  type: string;
  aggregation: MetricAggregation;
  field?: string | null;
};

export type MetricDefinition = {
  events: MetricEvent[];
  value?: string;
};

export const metricDefinitions = pgTable(
  'metric_definitions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    currentVersionId: uuid('current_version_id').references(
      (): AnyPgColumn => metricDefinitionVersions.id,
      { onDelete: 'set null' },
    ),
    createdAt: timestamp('created_at', { mode: 'date', precision: 3, withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { mode: 'date', precision: 3, withTimezone: true })
      .defaultNow()
      .$onUpdateFn(() => new Date())
      .notNull(),
  },
  (table) => [index('metric_definitions_project_id_idx').on(table.projectId)],
);

export const metricDefinitionVersions = pgTable(
  'metric_definition_versions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    metricDefinitionId: uuid('metric_definition_id')
      .notNull()
      .references(() => metricDefinitions.id, { onDelete: 'cascade' }),
    version: integer('version').notNull(),
    name: varchar('name', { length: 128 }).notNull(),
    description: text('description'),
    definition: jsonb('definition').$type<MetricDefinition>().notNull(),
    createdAt: timestamp('created_at', { mode: 'date', precision: 3, withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex('metric_definition_versions_metric_id_version_idx').on(
      table.metricDefinitionId,
      table.version,
    ),
  ],
);
