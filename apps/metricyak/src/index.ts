import { createClickHouseClient, migrate, setupKafkaIngestion } from '@metricyak/clickhouse';
import {
  BullMonitorEvalProducer,
  BullMonitorFiringsProducer,
  createKafka,
  createProducerConnectionOptions,
  ensureTopics,
  InMemoryMonitorDirtyBuffer,
  InMemoryMonitorEvalProducer,
  InMemoryMonitorFiringsProducer,
  KafkaEventsProducer,
  type MonitorDirtyBuffer,
  type MonitorEvalProducer,
  type MonitorFiringsProducer,
  RedisMonitorDirtyBuffer,
} from '@metricyak/queue';
import { createSecretCipher } from '@metricyak/secrets';
import { createDatabase } from '@metricyak/storage';
import { createApp } from '@/app.js';
import { startHttpServer } from '@/bootstrap/http.js';
import { assertSchemaReady } from '@/bootstrap/schema.js';
import { registerShutdown } from '@/bootstrap/shutdown.js';
import { startWorkers } from '@/bootstrap/workers.js';
import { loadConfig } from '@/config.js';
import { createContainer } from '@/container/container.js';

const config = loadConfig();
const db = createDatabase(config.databaseUrl);
await assertSchemaReady(db);

const clickhouse = createClickHouseClient(config.clickhouseUrl);
await migrate(clickhouse);
await setupKafkaIngestion(clickhouse, { brokers: config.clickhouseKafkaBrokers });

const kafka = createKafka(config.kafkaBrokers);
await ensureTopics(kafka);
const producer = new KafkaEventsProducer(kafka);
await producer.connect();
console.log(JSON.stringify({ level: 'info', msg: 'kafka events producer connected' }));

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
const app = createApp(container);

const server = startHttpServer(app, config);

const closeWorkers =
  !config.runWorkerInline && config.runWorkersInApi
    ? await startWorkers(container, config)
    : undefined;

registerShutdown(async (signal) => {
  console.log(JSON.stringify({ level: 'info', msg: `${signal} received, shutting down` }));
  await Promise.allSettled([
    new Promise<void>((resolve) => server.close(() => resolve())),
    closeWorkers?.(),
    producer.disconnect(),
  ]);
  process.exit(0);
});
