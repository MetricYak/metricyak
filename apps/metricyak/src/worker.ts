import { createClickHouseClient } from '@metricyak/clickhouse';
import {
  BullMonitorEvalProducer,
  BullMonitorSignalsProducer,
  createProducerConnectionOptions,
  InMemoryEventsProducer,
  InMemoryMonitorEvalProducer,
  InMemoryMonitorSignalsProducer,
  type MonitorEvalProducer,
  type MonitorSignalsProducer,
} from '@metricyak/queue';
import { createDatabase } from '@metricyak/storage';
import { assertSchemaReady } from '@/bootstrap/schema.js';
import { registerShutdown } from '@/bootstrap/shutdown.js';
import { startWorkers } from '@/bootstrap/workers.js';
import { loadConfig } from '@/config.js';
import { createContainer } from '@/container/container.js';

const config = loadConfig();
const db = createDatabase(config.databaseUrl);
const clickhouse = createClickHouseClient(config.clickhouseUrl);
await assertSchemaReady(db);
const producer = new InMemoryEventsProducer();
const signals: MonitorSignalsProducer = config.redisUrl
  ? new BullMonitorSignalsProducer(createProducerConnectionOptions(config.redisUrl))
  : new InMemoryMonitorSignalsProducer();
const evalProducer: MonitorEvalProducer = config.redisUrl
  ? new BullMonitorEvalProducer(createProducerConnectionOptions(config.redisUrl))
  : new InMemoryMonitorEvalProducer();
const container = createContainer(db, producer, signals, evalProducer, clickhouse);

const closeWorkers = await startWorkers(container, config);

registerShutdown(async (signal) => {
  console.log(JSON.stringify({ level: 'info', msg: `${signal} received, shutting down workers` }));
  await closeWorkers();
  process.exit(0);
});
