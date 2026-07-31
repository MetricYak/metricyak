import type { SignalProviderId } from '@metricyak/connectors';
import { index, jsonb, pgTable, text, timestamp, unique, uuid, varchar } from 'drizzle-orm/pg-core';
import { projects } from '@/schema/projects.js';
import { secrets } from '@/schema/secrets.js';

export const SIGNAL_CONNECTION_KINDS = ['manual_webhook', 'app_installation'] as const;
export type SignalConnectionKind = (typeof SIGNAL_CONNECTION_KINDS)[number];

export const SIGNAL_SOURCE_STATUSES = ['awaiting_first_delivery', 'healthy', 'failing'] as const;
export type SignalSourceStatus = (typeof SIGNAL_SOURCE_STATUSES)[number];

export type SignalSourceConfig = Record<string, unknown>;

export const signalSources = pgTable(
  'signal_sources',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 128 }).notNull(),
    provider: varchar('provider', { length: 32 }).$type<SignalProviderId>().notNull(),
    connectionKind: varchar('connection_kind', { length: 24 })
      .$type<SignalConnectionKind>()
      .notNull()
      .default('manual_webhook'),
    config: jsonb('config').$type<SignalSourceConfig>().notNull(),
    installationId: text('installation_id'),
    secretId: uuid('secret_id').references(() => secrets.id, { onDelete: 'set null' }),
    status: varchar('status', { length: 32 })
      .$type<SignalSourceStatus>()
      .notNull()
      .default('awaiting_first_delivery'),
    lastDeliveryAt: timestamp('last_delivery_at', {
      mode: 'date',
      precision: 3,
      withTimezone: true,
    }),
    lastError: text('last_error'),
    createdAt: timestamp('created_at', { mode: 'date', precision: 3, withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { mode: 'date', precision: 3, withTimezone: true })
      .defaultNow()
      .$onUpdateFn(() => new Date())
      .notNull(),
  },
  (table) => [
    index('signal_sources_project_id_idx').on(table.projectId),
    index('signal_sources_installation_id_idx').on(table.installationId),
    unique('signal_sources_project_id_name_key').on(table.projectId, table.name),
  ],
);
