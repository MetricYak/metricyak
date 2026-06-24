import { index, jsonb, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { metricDefinitions } from './metrics.js';
import { projects } from './projects.js';

export type MonitorBaseline = {
  type: 'relative';
  period: string;
};

export type MonitorSimpleCondition = {
  operator: 'lt' | 'lte' | 'gt' | 'gte' | 'eq' | 'neq';
  value: number;
  valueType: 'absolute' | 'percent_change';
  baseline?: MonitorBaseline | null;
};

export type MonitorCompoundCondition = {
  type: 'compound';
  operator: 'and' | 'or';
  conditions: MonitorSimpleCondition[];
};

export type MonitorCondition = MonitorCompoundCondition | MonitorSimpleCondition;

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
    condition: jsonb('condition').$type<MonitorCondition>().notNull(),
    window: varchar('window', { length: 16 }).notNull(),
    holdFor: varchar('hold_for', { length: 16 }).notNull(),
    workflowId: varchar('workflow_id', { length: 128 }),
    createdAt: timestamp('created_at', { mode: 'date', precision: 3, withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { mode: 'date', precision: 3, withTimezone: true })
      .defaultNow()
      .$onUpdateFn(() => new Date())
      .notNull(),
  },
  (table) => [index('monitors_project_id_idx').on(table.projectId)],
);
