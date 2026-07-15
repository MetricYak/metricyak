import {
  boolean,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { metricDefinitions } from '@/schema/metrics.js';
import { projects } from '@/schema/projects.js';

export const MONITOR_MISSING_DATA = ['skip', 'zero', 'fire'] as const;

export type MonitorMissingData = (typeof MONITOR_MISSING_DATA)[number];

export const MONITOR_COMPARISON_OPERATORS = ['lt', 'lte', 'gt', 'gte', 'eq', 'neq'] as const;

export type MonitorComparisonOperator = (typeof MONITOR_COMPARISON_OPERATORS)[number];

export type MonitorThresholdCondition = {
  operator: MonitorComparisonOperator;
  value: number;
};

export type MonitorFilter = {
  field: string;
  operator: 'eq' | 'neq' | 'in' | 'not_in';
  value: string | number | boolean | Array<string | number>;
};

export type MonitorScope = {
  splitBy?: string | null;
  fireWhen?: 'any' | 'all' | null;
  filter?: MonitorFilter | null;
};

export const monitors = pgTable(
  'monitors',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    metricId: uuid('metric_id')
      .notNull()
      .references(() => metricDefinitions.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 128 }).notNull(),
    description: text('description'),
    scope: jsonb('scope').$type<MonitorScope>(),
    condition: jsonb('condition').$type<MonitorThresholdCondition>().notNull(),
    window: varchar('window', { length: 16 }).notNull(),
    holdFor: varchar('hold_for', { length: 16 }).notNull(),
    enabled: boolean('enabled').notNull().default(true),
    missingData: varchar('missing_data', { length: 8 })
      .$type<MonitorMissingData>()
      .notNull()
      .default('skip'),
    nextEvalAt: timestamp('next_eval_at', { mode: 'date', precision: 3, withTimezone: true })
      .defaultNow()
      .notNull(),
    createdAt: timestamp('created_at', { mode: 'date', precision: 3, withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { mode: 'date', precision: 3, withTimezone: true })
      .defaultNow()
      .$onUpdateFn(() => new Date())
      .notNull(),
  },
  (table) => [
    index('monitors_project_id_idx').on(table.projectId),
    index('monitors_enabled_next_eval_at_idx').on(table.enabled, table.nextEvalAt),
  ],
);
