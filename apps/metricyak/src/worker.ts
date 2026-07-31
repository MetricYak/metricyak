import { createClickHouseClient } from '@metricyak/clickhouse';
import {
  BullMonitorEvalProducer,
  BullMonitorFiringsProducer,
  createProducerConnectionOptions,
  InMemoryEventsProducer,
  InMemoryMonitorDirtyBuffer,
  InMemoryMonitorEvalProducer,
  InMemoryMonitorFiringsProducer,
  type MonitorDirtyBuffer,
  type MonitorEvalProducer,
  type MonitorFiringsProducer,
  RedisMonitorDirtyBuffer,
} from '@metricyak/queue';
import { createSecretCipher } from '@metricyak/secrets';
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
const firings: MonitorFiringsProducer = config.redisUrl
  ? new BullMonitorFiringsProducer(createProducerConnectionOptions(config.redisUrl))
  : new InMemoryMonitorFiringsProducer();
const evalProducer: MonitorEvalProducer = config.redisUrl
  ? new BullMonitorEvalProducer(createProducerConnectionOptions(config.redisUrl))
  : new InMemoryMonitorEvalProducer();
const dirty: MonitorDirtyBuffer = config.redisUrl
  ? new RedisMonitorDirtyBuffer(config.redisUrl)
  : new InMemoryMonitorDirtyBuffer();
const secretCipher = createSecretCipher(config.secretsMasterKey);
const container = createContainer(
  db,
  producer,
  firings,
  evalProducer,
  clickhouse,
  dirty,
  secretCipher,
);

const closeWorkers = await startWorkers(container, config);

registerShutdown(async (signal) => {
  console.log(JSON.stringify({ level: 'info', msg: `${signal} received, shutting down workers` }));
  await closeWorkers();
  process.exit(0);
});
