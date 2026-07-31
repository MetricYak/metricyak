import type { SignalKind } from '@metricyak/connectors';
import { index, jsonb, pgTable, text, timestamp, unique, uuid, varchar } from 'drizzle-orm/pg-core';
import { projects } from '@/schema/projects.js';
import { signalSources } from '@/schema/signal-sources.js';

export type SignalAttributes = Record<string, unknown>;

export const signals = pgTable(
  'signals',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    sourceId: uuid('source_id')
      .notNull()
      .references(() => signalSources.id, { onDelete: 'cascade' }),
    kind: varchar('kind', { length: 16 }).$type<SignalKind>().notNull(),
    externalId: text('external_id').notNull(),
    occurredAt: timestamp('occurred_at', {
      mode: 'date',
      precision: 3,
      withTimezone: true,
    }).notNull(),
    endedAt: timestamp('ended_at', { mode: 'date', precision: 3, withTimezone: true }),
    title: text('title').notNull(),
    status: varchar('status', { length: 24 }),
    attributes: jsonb('attributes').$type<SignalAttributes>().notNull().default({}),
    createdAt: timestamp('created_at', { mode: 'date', precision: 3, withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { mode: 'date', precision: 3, withTimezone: true })
      .defaultNow()
      .$onUpdateFn(() => new Date())
      .notNull(),
  },
  (table) => [
    index('signals_project_id_occurred_at_idx').on(table.projectId, table.occurredAt),
    unique('signals_source_id_external_id_key').on(table.sourceId, table.externalId),
  ],
);
