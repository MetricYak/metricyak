import { sql } from 'drizzle-orm';
import {
  doublePrecision,
  index,
  jsonb,
  pgTable,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import type { MonitorThresholdCondition } from '@/schema/monitors.js';
import { monitors } from '@/schema/monitors.js';

export const MONITOR_EVENT_TYPES = ['fired'] as const;
export type MonitorEventType = (typeof MONITOR_EVENT_TYPES)[number];

export const monitorEvents = pgTable(
  'monitor_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    monitorId: uuid('monitor_id')
      .notNull()
      .references(() => monitors.id, { onDelete: 'cascade' }),
    series: varchar('series', { length: 256 }).notNull(),
    type: varchar('type', { length: 16 }).$type<MonitorEventType>().notNull(),
    value: doublePrecision('value').notNull(),
    threshold: jsonb('threshold').$type<MonitorThresholdCondition>().notNull(),
    occurredAt: timestamp('occurred_at', {
      mode: 'date',
      precision: 3,
      withTimezone: true,
    }).notNull(),
    relayedAt: timestamp('relayed_at', { mode: 'date', precision: 3, withTimezone: true }),
    createdAt: timestamp('created_at', { mode: 'date', precision: 3, withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('monitor_events_monitor_id_idx').on(table.monitorId),
    index('monitor_events_unrelayed_idx')
      .on(table.occurredAt)
      .where(sql`${table.relayedAt} is null`),
  ],
);
