import {
  doublePrecision,
  index,
  pgTable,
  primaryKey,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { monitors } from './monitors.js';

export const MONITOR_STATUSES = ['ok', 'pending', 'firing'] as const;
export type MonitorStatus = (typeof MONITOR_STATUSES)[number];

export const monitorState = pgTable(
  'monitor_state',
  {
    monitorId: uuid('monitor_id')
      .notNull()
      .references(() => monitors.id, { onDelete: 'cascade' }),
    series: varchar('series', { length: 256 }).notNull(),
    status: varchar('status', { length: 8 }).$type<MonitorStatus>().notNull().default('ok'),
    breachedSince: timestamp('breached_since', { mode: 'date', precision: 3, withTimezone: true }),
    lastValue: doublePrecision('last_value'),
    lastEvaluatedAt: timestamp('last_evaluated_at', {
      mode: 'date',
      precision: 3,
      withTimezone: true,
    }),
    updatedAt: timestamp('updated_at', { mode: 'date', precision: 3, withTimezone: true })
      .defaultNow()
      .$onUpdateFn(() => new Date())
      .notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.monitorId, table.series] }),
    index('monitor_state_monitor_id_idx').on(table.monitorId),
  ],
);
